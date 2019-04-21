// Configuration settings (config.js)

/* exported defaults */

var defaults = {
  overrideSaved: false,                   // These settings override saved user settings
  noSaved: 1,                             // 0 - always use saved settings; 1 - don't use with SSL VPNs; 2 - never use
  ignoreURLparameters: false,             // Ignore parameters specified via the URL (?...)
  //     onlyHTTPS: true,                     // Don't use WebSockets - go straight to HTTPS 
  //     noHTTPS: true,                       // Don't try using HTTPS instead of WebSockets (HTTPS requires Secure Gateway)
  autostart: false,                       // Start session automatically
  wsport: 8080,                           // Server port
  gwport: 443,                            // Secure Gateway port
  showAddress: false,                     // Show Access Server address in error dialogs
  dialogTimeoutMinutes: 2,                // Dialog timeouts
  sessionTimeoutMinutes: 0,               // Timeout for inactive session. Zero disables feature
  minSendInterval: 60,                    // Maximum frequency of mouse messages while dragging
  clipboard: true,                        // Enable clipboard redirection
  clipboardTimeoutSeconds: 15,            // Duration of clipboard copy notifier
  clipboardUseFlash: false,                // Try using Flash for copy to local clipboard
  clipboardKey: 12,                       // Key to open clipboard paste dialog. Set to false to disable
  clipboardSeamlessCopy: true,            // Try enabling seamless copy to local clipboard (works in Chrome)
  ctrlAltDelIcon: true,                   // Enable or disable ctrl-alt-del toolbar button. Defaults to true
  altTabIcon: true,                       // Enable or disable alt-tab toolbar button. Defaults to true
  fullscreenKeyMode: 2,                   // 0 - send F11 to remote session ; 1 - handle locally in IE ; 2 - always handle locally
  printing: true,                         // Enable printing redirection
  directprint: false,                     // Enable direct printing of the pdf
  printToNewTab: false,                    // Open printed files to a new tab. This allows you to print multiple files at once. Need to have "directprint" enabled. Works best in Chrome.
  fileDownload: true,                     // Enable file download
  fileDownloadIcon: true,                 // Enable file download icon
  fileUpload: true,                       // Enable file upload
  fileUploadIcon: true,                   // Enable file upload icon,
  uploadSizeLimit: 4096,                  // File upload size limit in MB. Default of 4096  
  specialKeys: true,                      // See http://support.microsoft.com/kb/186624
  blockAltOrCtrlCombinations: false,      // Block any key combination that includes CTRL or ALT
  blockCtrlP: false,                      // Block CTRL+P combination from being sent to the remote session
  fireFoxProgrammaticFullScreen: true,   // use FullScreen API on Firefox, will break ESC key usage while in full screen mode. Default: true
  chromeKeys: true,                       // Support special Chromebook keys, e.g. ALT+Backspace -> DEL
  longPressRightButton: 1,                // 0 - IE touch only; 1 - also Mac ; 2 - always
  reverseMouseWheel: 1,                   // 0 - never ; 1 - only on Mac ; 2 - always
  reverseTouchScroll: false,              // Reverse two-finger scrolling on touch devices. Defaults to false
  mouseWheelSpeed: 120,                   // Higher value for faster mouse wheel scroll
  rightToLeft: false,                     // For RTL hosts
  noEndDialog: false,                     // Do not display session disconnect dialog
  nameOnly: false,                        // Display only the connection name in title
  leaveMessage: "STR_LEAVING",            // Message to display when user tries to navigate away from page, empty for navigating without a warning
  fastLogoff: false,                      // Enable fast logoff for published apps (remoteapplicationmode must be true)
  redirectUrlsOnServer: true,             // Enable URL redirection on the server
  defaultErrorMessage: false,             // Enable displaying default translated error message when no match translation found
  reconnectOnDropped: true,               // Reconnect if the connection is dropped. Default: true
  reconnectMaxMinutes: 5,                 // Total time for attempting to reconnect when connection is dropped
  disableToolbar: false,                  // Don't show the popup toolbar
  toolbarInitialDisplayTimeout: 1000,     // Timeout on which the upload and download keys will be displayed if the server did not reply to disable them
  maxHorizontalItems: 0,                  // Maximum number of toolbar buttons displayed on the horizontal bar. Enter 0 for auto-detection
  notificationTimeOut: 5000,              // How long notifications will be displayed without user interaction (in ms). Default: 5000
  enableAutoKeyboard: true,               // Enable auto keyboard show/hide. Default: true
  clickAnimation: false,                   // Enable or disable touchscreen click animation
  touchScreen: true,                      // Enable or disable touchscreen recognition and handling
  touchPad: true,                         // Enable touchpad support for mobile devices.
  rdpTouchEnabled: true,                 // multi touch enable   -- if true, disables UI touch events and sends all the information to the RDP server
  rdpTouchActive: false,                  // multi touch active   -- initial multi-touch state
  rdpTouchAction: 0,                     // 0: complete disabled 1: Give a warning ("my application prefers to have touch .. and your device does not) 2: Give an error ("my application requires touch … you don’t have it … so … tough luck)   … kill the session  3: Give a 'sort of error'  ("my application really likes to use touch … and you don't have it … should we go ahead?  Yes/no)
  MinWidth: 'auto',                       // Minimum session width. Use 'auto' for default of 768
  MinHeight: 'auto',                      // Minimum session height. Use 'auto' for default 600
  //     message: "",                         // Optional message to display below input fields
  //     locale: "en-us",                     // Locale for UI. Default is "en-us". See resources/lang/dictionary.list.txt for list of supported locales
  //     convert_unicode_to_scancode: true,   // Set to true to use scan-code for locale specific input
  //     keyboard_locale: "00000409",         // Locale code for keyboard input (when using scan-codes)
  //     endURL: "",                          // URL to go to when session has ended (# value closes window; ^ prefix to assign to window instead of top)
  //     address: "",                         // Address of server 
  //     full_address: "",                    // Address of RDP host
  //     username: "",                        // Default user name for RDP session
  //     password: "",                        // Password for RDP session (plain text)
  //     domain: "",                          // Optional domain for RDP session (can also be placed in username field)
  //     encryption: false,                   // Encrypt communication to Access Server
  //     blaze_acceleration: false,           // Enable Blaze acceleration
  //     blaze_image_quality: 40,             // Image quality for Blaze acceleration
  //     resolution: "1024,768",              // Default resolution for remote session: browser screen 640,480 800,600 1024,768 1280,720 1280,768 1280,1024 1440,900 1440,1050 1600,1200 1680,1050 1920,1080 1920,1200
  //     use_gateway: false,                  // Use Ericom Secure Gateway (ESG)
  //     gateway_address: "",                 // ESG address
  //     audiomode:0,                         // RDP audio mode: 0 - play locally, 1 - play on server; 2 - do not play
  //     remoteapplicationmode: false,        // Remote application one - single app instead of full desktop
  //     alternate_shell: "",                 // Startup application
  //     shell_working_directory: "",         // Startup directory
  //     console: false,                      // Console (admin) session
  //     settingsURL: "resources/blaze.txt",  // URL from which to download connection settings
  //     hidden: "",                          // List of fields to hide (Advanced button is showAdvanced)
  //     restrictHost: "127.*,localhost",     // Client can't connect to a host in this list
  //     closeProgressState: "connected",     // When to close progress: connected, logged in, active, start
  //     closeProgressDelay: 2500,            // How long to delay the progress close (milliseconds)
  //     endProgressState: "start",           // In any event, close progress by this event
  //     progressBackgroundColor: "black",    // Background color during progress (instead of see-through)
  //     use_client_timezone: true,           // Use client time-zone (time-zome redirection)
  //     redirect: false,                     // URL redirection

  // System settings - do not change:
  singlePort: true,
  textOnly: false,
  disableBulkCompression: false,
  disableCustomCompression: false,
  hiddenUpdateRateSeconds: 12,
  keepAliveRateSeconds: 30,
  executeTimeout: 500,
  disableImageReuse: false,
  noWorkers: false,
  inTestMode: false,
  _last: 0
};
