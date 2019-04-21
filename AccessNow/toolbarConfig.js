/*
    Dynamic toolbar configuration.
    The default configuration should reflect the current toolbar.
    See the default configuration for a better understanding of the different parameters.
    
    -- INFO: There are three buttons that are enabled by default and cannot be customized here: clipboard, upload and download
    These buttons can be enabled or disabled using the config.js settings		
    
    -- Configuration parameters --
    Each button is represented by an object with the following properties:
    "name" : Name of the button. It is not displayed anywhere. Should be different for every button.
    "description" : Text used for the tool-tip. If it is a translation key present in the translation files, it will be translated, otherwise not.
    "position" : Which list to put the button in. "horizontal" or "vertical". The order in the list is the same as the order in which buttons are defined within this file.
    "showIf" : Optional. Conditions on which to enable the button. You can use basic logical operators ( || && ! ) and parenthesis on the global configuration variables available. Please see the list of values.
    "toggle" : true or false. Optional. This defines if the button is a simple one or a toggle.
    
    
    For simple buttons you should then define the following properties:
    "icon" : URL to the image relative to the /AccessNow/ path. Should be 38x38px
    "action": {
        "method": name of the action to execute. Please see the list (below) for available methods.
        "params": Array of parameters to call the method with
    }
    
    For toggle buttons you should define the following:  ( See the "auto_keyboard" button in the default configuration )
    "states": {  // there are two states: "enabled" and "disabled"
            "enabled": {
                "icon": URL of the image for the "enabled" state
                "action": {
                    "method": Action to execute when in the "enabled" state. After clicking the button, this is executed and then we go to the "disabled" state
                    "params": Array of parameters to be passed to the method
                }
            },
            "disabled": {
                "icon": URL of the image for the "disabled" state
                "action": {
                    "method": Action to execute when in the "disabled" state. After clicking the button, this is executed and then we go to the "disabled" state
                    "params": Array of parameters to be passed to the method
                }
            }
        },
        "default": "enabled" // Default state of the button. "enabled" or "disabled"


    -- Available methods --
    
    - sendKeys : Send a combination of keys to the server.
        A lot can be achieved with this. You can use normal windows shortcuts to get all kinds of effects, for example Windows key is CTRL+ESCAPE.
        Use integer keycodes directly or use the common ones defined in keycodes.js. For example, the Escape key is KEYS.ESCAPE
        If you don't know the keycode for a specific key and cannot find it in keycodes.js, go to http://www.asquare.net/javascript/tests/KeyCode.html, click inside the input and press the key to reveal the value.	 	
    - disconnect : Will open the disconnect dialog
    - gestures : Will open the mobile gestures help
    - help : Will open the help dialog
    - toggleKeyboard : open/close the keyboard depending on the context
    - toggleAutoKeyboard : enable/disable the auto-keyboard feature (should only appear if it is enabled)
    - invoke:  the parameter is a single JavaScript function to execute.   params: [  function() { alert('hello') ; }]
    
    
    -- Available configuration variables --
    
    - The "is" variable contains data about the device and environment. Most of these are self-explanatory
    is.logging
    is.HTTPS // using encrypted communication
    is.iPhone  
    is.iPad
    is.iOS
    is.android
    is.silk
    is.webkit
    is.chrome
    is.chromeOS
    is.IE
    is.firefox
    is.safari
    is.oldSafari // safari older than version 5.1 (inclusive)
    is.mobile
    is.TV
    is.mac
    is.SSLVPN // running through a secure VPN solution like Juniper or CISCO
    is.Juniper
    is.CISCO
    is.CheckPoint
    is.gateway // running through the Ericom Secure Gateway
    is.view 
    is.managed // running in managed mode (like from AccessPortal)
    
    - The "globals" variable contains settings set by the user/admin/server
    You can use any of the settings in config.js with the globals variable. For example "globals.enableAutoKeyboard" or "globals.ctrlAltDelIcon"
    
*/

var toolbarConfig = [
    {
        "name": "esc",
        "description": "STR_ESC_KEY",
        "position": "horizontal",
        "toggle": false,
        "icon": "resources/images/toolbar/ESC_38.png",
        "labels": ["ESC"],
        "action": {
            "method": "sendKeys",  // "method to call"
            "params": [KEYS.ESCAPE] // "parameters"
        },
    },
    {
        "name": "tab",
        "description": "STR_TAB_KEY",
        "position": "horizontal",
        "toggle": false,
        "icon": "resources/images/toolbar/TAB_38.png",
        "labels": ["TAB"],
        "action": {
            "method": "sendKeys",  // "method to call"
            "params": [KEYS.TAB] // "parameters"
        },
    },
    {
        "name": "ctrlAltDel",
        "description": "STR_CTRL_ALT_DEL_KEY",
        "position": "horizontal",
        "toggle": false,
        "icon": "resources/images/toolbar/CTRL_ALT_DEL_38.png",
        "labels": ["CTRL", "ALT", "DEL"],
        "action": {
            "method": "sendKeys",  // "method to call"
            "params": [KEYS.CTRL, KEYS.ALT, KEYS.DELETE] // "parameters"
        },
        "showIf": "globals.ctrlAltDelIcon && !globals.remoteapplicationmode"
    },
    {
        "name": "altTab", // do NOT modify this button. images are safe to modify
        "special": true,
        "description": "STR_ALT_TAB",
        "position": "horizontal",
        "toggle": false,
        "icon": "resources/images/toolbar/alt_tab_off_38.png", // default icon TODO modify icons
        "labels": ["ALT", "TAB"],
        "icons": {
            "off": "resources/images/toolbar/alt_tab_off_38.png",
            "on": "resources/images/toolbar/alt_tab_on_38.png"
        },
        "action": {
            "method": "toggleAltTab",  // "method to call"
        },
        "showIf": "globals.altTabIcon && !globals.remoteapplicationmode"
    },
    {
        "name": "winkey",
        "description": "STR_WIN_KEY",
        "position": "horizontal",
        "toggle": false,
        "icon": "resources/images/toolbar/windows.png",
        "action": {
            "method": "sendKeys",  // "method to call"
            "params": [KEYS.CTRL, KEYS.ESCAPE] // CTRL+ESCAPE is Windows key
        },
        "showIf": "!globals.remoteapplicationmode",
    },
    {
        "name": "disconnect",
        "description": "STR_DISCONNECT",
        "position": "vertical",
        "toggle": false,
        "icon": "resources/images/toolbar/disconnect.png",
        "action": {
            "method": "disconnect",  // "method to call"
            "params": [] // "parameters"
        },
    },
    // {
    //     "name": "about",
    //     "description": "STR_ABOUT",
    //     "position": "vertical",
    //     "toggle": false,
    //     "icon": "resources/images/toolbar/info_38.png",
    //     "action": {
    //         "method": "help",  // "method to call"
    //         "params": [] // "parameters"
    //     },
    // },
    {
        "name": "gestures",  // this will be used for the id of the div..nor really necessary but it's always good to have an identifier
        "description": "STR_GESTURES_HELP",  // if you put a translation string then it will be translated, otherwise just put as plaintext. The translation function already handles this I think
        "position": "horizontal",  // "horizontal" or "vertical"
        "toggle": false, // a toggle button has two states. if toggle is false, then it has only one action, otherwise it has two
        "icon": "resources/images/toolbar/gesturesHelp.png", // "url to the icon image"
        "action": {
            "method": "gestures",  // "method to call"
            "params": [] // "parameters"
        },
        "showIf": "globals.touchScreen"
    },

    {
        "name": "keyboard",
        "description": "Show/hide the keyboard",
        "position": "vertical",
        "toggle": false,
        "icon": "resources/images/toolbar/keybrd.png",
        "action": {
            "method": "toggleKeyboard",
            "params": []
        },
        "showIf": "globals.enableAutoKeyboard && ( ((is.mobile || is.TV) && !is.desktopIE && globals.forceAutoKeyboardDefault) || (globals.forceAutoKeyboard) )"
    },
    {
        "name": "auto_keyboard",
        "description": "STR_AUTO_KEYBOARD",
        "position": "vertical",
        "toggle": true,
        "states": {
            "enabled": {
                "icon": "resources/images/toolbar/keybrd_auto.png",
                "action": {
                    "method": "toggleAutoKeyboard",
                    "params": [false] // turn auto-keyboard OFF
                }
            },
            "disabled": {
                "icon": "resources/images/toolbar/keybrd_auto.png",
                "action": {
                    "method": "toggleAutoKeyboard",
                    "params": [true]  // turn auto-keyboard on
                }
            }
        },
        "initialState": "enabled",
        "showIf": "globals.enableAutoKeyboard && ( ((is.mobile || is.TV) && !is.desktopIE && globals.forceAutoKeyboardDefault) || (globals.forceAutoKeyboard) )"
    },
    {
        "name": "rpd_touch_toggle",
        "description": "STR_RDP_TOUCH_TOGGLE",
        "position": "vertical",
        "toggle": true,
        "states": {
            "enabled": {
                "icon": "resources/images/toolbar/rdpTouch_24.png",
                "action": {
                    "method": "toggleRdpTouch",
                    "params": [false] // disable the touchhpad
                }
            },
            "disabled": {
                "icon": "resources/images/toolbar/rdpTouch_24.png",
                "action": {
                    "method": "toggleRdpTouch",
                    "params": [true]  // enable the touchpad
                }
            }
        },
        "initialState": "disabled",
        "showIf": "globals.touchScreen",
        "startHidden": true
    },
    {
        "name": "touchpad_toggle",
        "description": "STR_TOUCHPAD_TOGGLE",
        "position": "vertical",
        "toggle": true,
        "states": {
            "enabled": {
                "icon": "resources/images/toolbar/touchpad.png",
                "action": {
                    "method": "toggleTouchpad",
                    "params": [false] // disable the touchhpad
                }
            },
            "disabled": {
                "icon": "resources/images/toolbar/touchpad.png",
                "action": {
                    "method": "toggleTouchpad",
                    "params": [true]  // enable the touchpad
                }
            }
        },
        "initialState": "disabled",
        "showIf": "globals.touchScreen && globals.touchPad"
    }
    // {
    //     "name": "test",
    //     "description": "SEND TEST JSON",
    //     "position": "horizontal",
    //     "toggle": false,
    //     "icon": "resources/images/toolbar/touchpad.png",
    //     "labels": ["TEST"],
    //     "action": {
    //         "method": "sendJSON",  // "method to call"
    //         "params": ['x', 'y', 'z'] // "parameters"
    //     },
    // }

];