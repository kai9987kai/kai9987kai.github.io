const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const base=process.env.BASE_URL||'http://127.0.0.1:8080';
const out=path.resolve('output/browser');fs.mkdirSync(out,{recursive:true});

// Use a Chromium that is already on the machine when there is one, rather than
// insisting on the exact build this Playwright version would download. Set
// CHROMIUM_PATH to point somewhere else.
function resolveChromium(){
  const candidates=[process.env.CHROMIUM_PATH,'/opt/pw-browsers/chromium'].filter(Boolean);
  for(const candidate of candidates){
    try { if(fs.existsSync(candidate)) return candidate; } catch {}
  }
  return undefined;
}

(async()=>{
  const executablePath=resolveChromium();
  if(executablePath) console.log(`using pre-installed Chromium at ${executablePath}`);
  const browser=await chromium.launch(executablePath?{headless:true,executablePath}:{headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const checks=[];
  const skipped=[];
  const check=(name,condition)=>{assert.ok(condition,name);checks.push(name);};

  /**
   * The Nexus loads TensorFlow.js and Chart.js from a public CDN. On a machine
   * with no route to it those checks cannot run; report that plainly rather
   * than failing as though the code were broken, and never as though they passed.
   */
  const cdnReachable=async()=>{
    try {
      const probe=await page.request.get('https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js',{timeout:15000});
      return probe.ok();
    } catch { return false; }
  };
  try {
    await page.goto(base+'/');
    await page.screenshot({path:path.join(out,'launch-desktop.png'),fullPage:true});
    await page.getByRole('link',{name:'Enter World Lab'}).click();
    await page.waitForFunction(()=>!!window.diamondLab);
    check('initial world and metrics',await page.evaluate(()=>diamondLab.agents.length===4&&diamondLab.stepCount===0&&Number(document.querySelector('#metric-mae').textContent)>0));
    await page.click('#step-button');
    check('step advances once',await page.evaluate(()=>diamondLab.stepCount===1&&!diamondLab.running));
    for(const planner of ['beam','legacy','greedy','random']) {
      await page.selectOption('#planner-mode',planner);await page.click('#reset-button');
      await page.evaluate(()=>advanceTime(500));
      check(planner+' runs 30 logical ticks',await page.evaluate(()=>diamondLab.stepCount===30&&diamondLab.agents.every(a=>Number.isFinite(a.totalExtrinsic))));
    }
    await page.selectOption('#planner-mode','beam');await page.click('#reset-button');
    check('snapshot roundtrip replays exact future',await page.evaluate(()=>{
      advanceTime(1000);const saved=JSON.parse(JSON.stringify(diamondLab.captureSnapshot()));
      advanceTime(1500);const expected=JSON.stringify(diamondLab.captureSnapshot());
      diamondLab.restoreSnapshot(saved);advanceTime(1500);
      return JSON.stringify(diamondLab.captureSnapshot())===expected;
    }));
    check('import preserves continuous parameter precision',await page.evaluate(()=>{
      const run=DiamondCore.createRun(29,2,{learningRate:.234,discount:.9234,riskAversion:.251});
      diamondLab.restoreSnapshot(DiamondState.serializeRun(run));
      return diamondLab.params().learningRate===.234&&diamondLab.params().discount===.9234&&diamondLab.params().riskAversion===.251;
    }));
    const before=await page.evaluate(()=>JSON.stringify(diamondLab.captureSnapshot()));
    await page.setInputFiles('#load-json',{name:'broken.json',mimeType:'application/json',buffer:Buffer.from('{"version":2}')});
    await page.waitForFunction(()=>document.querySelector('#load-json').value==='');
    check('invalid file preserves live run',await page.evaluate(()=>JSON.stringify(diamondLab.captureSnapshot()))===before);
    const [snapshotDownload]=await Promise.all([page.waitForEvent('download'),page.click('#save-json')]);
    await snapshotDownload.saveAs(path.join(out,'snapshot.json'));
    await page.click('#step-button');
    const [chooser]=await Promise.all([page.waitForEvent('filechooser'),page.click('#load-snapshot-button')]);
    await chooser.setFiles(path.join(out,'snapshot.json'));
    await page.waitForFunction(()=>document.querySelector('#load-json').value==='');
    check('download then upload restores run',await page.evaluate(()=>JSON.stringify(diamondLab.captureSnapshot()))===before);
    await page.evaluate(()=>document.activeElement.blur());await page.keyboard.press('s');
    check('keyboard steps outside controls',await page.evaluate(()=>diamondLab.stepCount===1));
    await page.selectOption('#selected-agent','2');
    for(const view of ['belief','uncertainty','qmax','visits','error']) {
      await page.selectOption('#model-view',view);check('model view '+view,await page.evaluate(()=>JSON.parse(render_game_to_text()).selectedAgent===2));
    }
    await page.selectOption('#model-view','belief');
    for(const chart of ['reward','model','survival']) await page.selectOption('#chart-mode',chart);
    await page.selectOption('#chart-mode','reward');
    // Request/cancel frame instrumentation makes this lifecycle check deterministic.
    check('rapid run/pause leaves one scheduled animation',await page.evaluate(()=>{
      diamondLab.pause();const request=window.requestAnimationFrame,cancel=window.cancelAnimationFrame;
      const pending=new Set();let id=100000;
      window.requestAnimationFrame=()=>{pending.add(++id);return id;};window.cancelAnimationFrame=x=>pending.delete(x);
      diamondLab.toggleRun();diamondLab.toggleRun();diamondLab.toggleRun();const size=pending.size;diamondLab.pause();
      window.requestAnimationFrame=request;window.cancelAnimationFrame=cancel;return size===1&&pending.size===0;
    }));
    await page.click('#preset-swarm');
    check('swarm updates count and labels',await page.evaluate(()=>diamondLab.agents.length===8&&document.querySelector('#num-agents-value').textContent==='8'));
    await page.locator('#num-agents').evaluate(el=>{el.value='2';el.dispatchEvent(new Event('input'));});await page.fill('#seed-input','1337');await page.click('#reset-button');
    const live=await page.evaluate(()=>JSON.stringify(diamondLab.captureSnapshot()));
    await page.fill('#experiment-seeds','11,29');await page.fill('#experiment-steps','30');await page.click('#experiment-run');
    await page.waitForFunction(()=>!diamondLab.experimentBusy&&diamondLab.experimentResult?.complete);
    check('experiment renders pairs and uncertainty',await page.locator('#experiment-results tbody tr').count()===2&&await page.locator('#experiment-results').textContent().then(s=>s.includes('95%')));
    check('experiment leaves live world intact',await page.evaluate(()=>JSON.stringify(diamondLab.captureSnapshot()))===live);
    const [report]=await Promise.all([page.waitForEvent('download'),page.click('#experiment-json')]);await report.saveAs(path.join(out,'comparison.json'));
    check('report contains completed pairs',JSON.parse(fs.readFileSync(path.join(out,'comparison.json'))).completedPairs===2);
    const [csv]=await Promise.all([page.waitForEvent('download'),page.click('#experiment-csv')]);await csv.saveAs(path.join(out,'comparison.csv'));
    check('CSV has header and two pairs',fs.readFileSync(path.join(out,'comparison.csv'),'utf8').trim().split('\n').length===3);
    await page.evaluate(()=>advanceTime(2000));
    const [metricsCSV]=await Promise.all([page.waitForEvent('download'),page.click('#export-csv')]);
    await metricsCSV.saveAs(path.join(out,'metrics.csv'));
    check('metrics CSV exports chart samples and respawn counts',fs.readFileSync(path.join(out,'metrics.csv'),'utf8').trim().split('\n').length===121&&fs.readFileSync(path.join(out,'metrics.csv'),'utf8').includes('respawns'));
    await page.screenshot({path:path.join(out,'worldlab-desktop.png'),fullPage:true});
    await page.fill('#experiment-steps','2000');await page.click('#experiment-run');await page.click('#experiment-cancel');
    await page.waitForFunction(()=>!diamondLab.experimentBusy);
    check('cancel returns labeled partial results',await page.locator('#experiment-status').textContent().then(s=>s.includes('Cancelled')));
    await page.fill('#experiment-seeds','11,11');await page.click('#experiment-run');
    check('duplicate seeds rejected',await page.locator('#experiment-status').textContent().then(s=>s.includes('distinct')));
    await page.setViewportSize({width:390,height:844});await page.goto(base+'/worldlab.html');
    await page.waitForFunction(()=>!!window.diamondLab);await page.click('#step-button');
    check('worldlab fits mobile viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    check('mobile run controls precede the world',await page.evaluate(()=>document.querySelector('#run-button').getBoundingClientRect().top<document.querySelector('#world-canvas').getBoundingClientRect().top));
    await page.evaluate(()=>scrollTo(0,0));
    await page.screenshot({path:path.join(out,'worldlab-mobile-top.png')});
    await page.screenshot({path:path.join(out,'worldlab-mobile.png'),fullPage:true});
    await page.goto(base+'/');check('launch fits mobile viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:path.join(out,'launch-mobile.png'),fullPage:true});
    await page.goto('file:///'+path.resolve('worldlab.html').replaceAll('\\','/'));
    await page.waitForFunction(()=>!!window.diamondLab);await page.click('#step-button');
    check('worldlab opens directly from disk',await page.evaluate(()=>diamondLab.stepCount===1));
    const nexusReachable=await cdnReachable();
    if(!nexusReachable){
      skipped.push('Nexus section skipped: no route to cdn.jsdelivr.net for TensorFlow.js and Chart.js');
      console.warn('SKIPPED: '+skipped[skipped.length-1]);
    }
    if(nexusReachable){
    await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/diamond-nexus.html');
    await page.waitForFunction(()=>document.body.dataset.simStatus==='ready',{},{timeout:30000});
    check('Nexus initializes with real libraries',await page.evaluate(()=>typeof tf==='object'&&typeof Chart==='function'));
    await page.fill('#num-agents','1');await page.locator('#num-agents').dispatchEvent('change');
    await page.waitForFunction(()=>simulation.agents.length===1&&!simulation._pendingMutations);
    check('Nexus single-agent live step',await page.evaluate(async()=>{await simulation.step();return simulation.totalSteps===1&&simulation.agents.length===1;}));
    await page.evaluate(async()=>{const active=simulation.step();await simulation.reset();await active;});
    check('Nexus reset waits for training',await page.evaluate(()=>simulation.totalSteps===0&&!simulation._stepPromise));
    await page.evaluate(()=>simulation.saveSimulation());await page.evaluate(()=>simulation.step());await page.evaluate(()=>simulation.loadSimulation());
    check('Nexus checkpoint reload',await page.evaluate(()=>simulation.totalSteps===0&&simulation.agents.length===1));
    await page.evaluate(async()=>{for(let i=0;i<5;i++) await simulation.step();});
    await page.screenshot({path:path.join(out,'nexus-desktop.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844});
    check('Nexus fits mobile viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:path.join(out,'nexus-mobile-top.png')});
    await page.screenshot({path:path.join(out,'nexus-mobile.png'),fullPage:true});
    }

    // Fly Lab
    await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/fly-diamond-nexus.html');
    await page.waitForFunction(()=>!!window.flyLab);
    check('Fly Lab boots three agents with their own registers',await page.evaluate(()=>{
      flyLab.advance(30);
      const keys=Array.from(flyLab.syncytium.egoStates.keys()).sort();
      return keys.join(',')==='agent1,agent2,agent3'&&flyLab.simStep===30;
    }));
    check('one environment tick per step despite three flies',await page.evaluate(()=>
      flyLab.telemetry().tick===flyLab.simStep&&flyLab.telemetry().step===flyLab.simStep*3));
    check('upgraded circuit mechanisms are live',await page.evaluate(()=>{
      const t=flyLab.telemetry();
      return t.compassMode==='attractor'&&t.mbInhibition==='apl'&&t.plasticityRule==='dan-ltd'
        &&t.consensusMode==='gated'&&t.ringCertainty>0&&t.kcSparsity>0&&t.kcSparsity<1;
    }));
    check('flies hold distinct headings',await page.evaluate(()=>{
      flyLab.advance(40);
      const heads=['agent1','agent2','agent3'].map(k=>flyLab.syncytium.egoStates.get(k)[1].scalars.compassHeading.toFixed(5));
      return new Set(heads).size>1;
    }));
    check('no move leaves the grid',await page.evaluate(()=>{
      for(let i=0;i<120;i++) flyLab.advance(1);
      const e=flyLab.env,g=e.gridSize;
      return [1,2,3].every(n=>e['agent'+n+'X']>=0&&e['agent'+n+'X']<g&&e['agent'+n+'Y']>=0&&e['agent'+n+'Y']<g);
    }));
    check('text hook reports all three agents',await page.evaluate(()=>{
      const state=JSON.parse(render_game_to_text());
      return state.agents.length===3&&state.agents[2].name==='Cartographer-Scout'&&Number.isFinite(state.tick);
    }));
    check('Fly Lab save and load round-trips a run',await page.evaluate(()=>{
      flyLab.advance(10);flyLab.save();
      const before=JSON.stringify({x:flyLab.env.agent3X,y:flyLab.env.agent3Y,d:flyLab.diamonds});
      flyLab.reset();flyLab.load();
      return JSON.stringify({x:flyLab.env.agent3X,y:flyLab.env.agent3Y,d:flyLab.diamonds})===before;
    }));
    await page.screenshot({path:path.join(out,'fly-desktop.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844});
    check('Fly Lab fits mobile viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:path.join(out,'fly-mobile.png'),fullPage:true});

    check('no uncaught browser errors',errors.length===0);
    fs.writeFileSync(path.join(out,'receipt.json'),JSON.stringify({checks,skipped,errors},null,2));
    console.log(`${checks.length} browser checks passed${skipped.length?`, ${skipped.length} section(s) skipped`:''}; screenshots and receipts: ${out}`);
    for(const note of skipped) console.log(`  skipped: ${note}`);
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
