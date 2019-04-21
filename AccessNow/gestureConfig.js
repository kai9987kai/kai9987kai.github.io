/*
  Gesture configuration file
  
  Configurable gesture (configuration parameter string) - default action:
  Two-finger gestures:
    Swipe Up (twoFingerSwipeUp) - Scroll Up
    Swipe Down (twoFingerSwipeDown) - Scroll Down
    Swipe Left (twoFingerSwipeLeft)- noAction
    Swipe Right (twoFingerSwipeRight) - noAction
    Tap (twoFingerTap)- doubleClickAtLeftFinger
  Three-finger gestures:
    Swipe Up (threeFingerSwipeUp) - noAcion
    Swipe Down (threeFingerSwipeDown) - noAction
    Swipe Left (threeFingerSwipeLeft) - arrowRight
    Swipe Right (threeFingerSwipeRight) - arrowLeft
    Tap (threeFingerTap) - toggleKeyboard
    
  Possible actions (configuration string):
    No action (noAction) 
    Double click at left finger (doubleClickAtLeftFinger)  
    Toggle virtual keyboard (toggleKeyboard) 
    [NYI] - Toggle touchpad mouse mode (toggleTouchpad) 
    [NYI] - Zoom (zoom) 
    Scroll Down (scrollDown)   
    Scroll Up (scrollUp)  
    Disconnect (disconnect) 
    [NYI] - Context menu (contextMenu)  
    Arrow Left (arrowLeft) 
    Arrow Right (arrowRight) 
    Arrow Up (arrowUp) 
    [NYI] - Arrow Down (arrowDown) 
    Page Up (pageUp) 
    Page Down (pageDown) 
    Tab (tab) 
    [NYI] - Shift+Tab (shiftTab) 
    [NYI] - Alt+Tab (altTab) 
    [NYI] - Alt+Shift (altShift) 
    Alt+F4 (altF4) 
    Ctrl+F4 (ctrlF4) 
    [NYI] - Left Alt (leftAltKey) 
    Windows Key (windowsKey) 
    Ctrl+Escape (ctrlEsc) 
    [NYI] - Print Screen (printScreen) 
    [NYI] - Ctrl+Shift (ctrlShift) 
    [NYI] - Windows Key + Space (winSpace) 

Bugs and limitations:

  Gesture help dialog does not reflect configuration, it is hardcoded - NYI (needs images, text and translations)
  Double click at left finger (doubleClickAtLeftFinger) only makes sense with Two-finger Tap or Three-finger Tap (no swipes)
  Scroll Up/Down (scrollUp, scrollDown) only make sense with Two-finger or Three-finger swipes (no taps)
  Actions NYI or not working: 
  - Toggle touchpad mouse mode 
  - Zoom 
  - Context menu
  - Arrow Down 
  - Shift+Tab 
  - Alt+Tab 
  - Alt+Shift 
  - Left Alt 
  - Print Screen 
  - Ctrl+Shift 
  - Windows Key + Space 
   
*/

var gestureConfig = {
  "twoFingerSwipeUp": {
    "method": "scrollUp",
  },
  "twoFingerSwipeDown": {
    "method": "scrollDown",
  },
  "twoFingerSwipeLeft": {
    "method": "noAction",
  },
  "twoFingerSwipeRight": {
    "method": "noAction",
  },
  "twoFingerTap": {
    "method": "doubleClickAtLeftFinger",
  },
  "threeFingerSwipeUp": {
    "method": "noAction",
  },
  "threeFingerSwipeDown": {
    "method": "noAction",
  },
  "threeFingerSwipeLeft": {
    "method": "arrowRight",
  },
  "threeFingerSwipeRight": {
    "method": "arrowLeft",
  },
  "threeFingerTap": {
    "method": "toggleKeyboard",
  },
};