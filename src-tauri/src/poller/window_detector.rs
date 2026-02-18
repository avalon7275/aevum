#[cfg(windows)]
use windows::Win32::Foundation::HWND;
#[cfg(windows)]
use windows::Win32::UI::WindowsAndMessaging::{
    GetForegroundWindow, GetWindowTextLengthW, GetWindowTextW,
};
#[cfg(windows)]
use windows::Win32::System::Threading::{
    OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_FORMAT, PROCESS_QUERY_LIMITED_INFORMATION,
};
#[cfg(windows)]
use windows::Win32::UI::WindowsAndMessaging::GetWindowThreadProcessId;

use crate::error::AppError;

#[derive(Debug, Clone, serde::Serialize)]
pub struct WindowSnapshot {
    pub title: String,
    pub process_name: String,
}

#[cfg(windows)]
pub fn get_foreground_window() -> Result<WindowSnapshot, AppError> {
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.0.is_null() {
            return Err(AppError::WindowDetection(
                "No foreground window".to_string(),
            ));
        }

        let title = get_window_title(hwnd)?;
        let process_name = get_process_name(hwnd)?;

        Ok(WindowSnapshot {
            title,
            process_name,
        })
    }
}

#[cfg(windows)]
unsafe fn get_window_title(hwnd: HWND) -> Result<String, AppError> {
    let length = GetWindowTextLengthW(hwnd);
    if length == 0 {
        return Ok(String::new());
    }

    let mut buffer = vec![0u16; (length + 1) as usize];
    let copied = GetWindowTextW(hwnd, &mut buffer);
    if copied == 0 {
        return Ok(String::new());
    }

    Ok(String::from_utf16_lossy(&buffer[..copied as usize]))
}

#[cfg(windows)]
unsafe fn get_process_name(hwnd: HWND) -> Result<String, AppError> {
    let mut pid: u32 = 0;
    GetWindowThreadProcessId(hwnd, Some(&mut pid));

    if pid == 0 {
        return Ok(String::new());
    }

    let process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid);
    let process = match process {
        Ok(h) => h,
        Err(_) => return Ok(String::new()),
    };

    let mut buffer = vec![0u16; 1024];
    let mut size = buffer.len() as u32;

    let result = QueryFullProcessImageNameW(
        process,
        PROCESS_NAME_FORMAT(0),
        windows::core::PWSTR(buffer.as_mut_ptr()),
        &mut size,
    );

    if result.is_err() {
        return Ok(String::new());
    }

    let full_path = String::from_utf16_lossy(&buffer[..size as usize]);

    // Extract just the filename from the full path
    let name = full_path
        .rsplit('\\')
        .next()
        .unwrap_or(&full_path)
        .to_lowercase();

    Ok(name)
}

// ── macOS implementation ──────────────────────────────────────────────────────
// Uses CGWindowListCopyWindowInfo to get the frontmost on-screen window.
// Returns the application name (lowercased) as process_name and the window title.
// Note: window titles require Screen Recording permission on macOS 10.15+.
// Without it, DAW detection still works (via app name) but project name extraction won't.

#[cfg(target_os = "macos")]
mod macos_ffi {
    use std::ffi::{c_void, CString};

    pub type CFTypeRef = *const c_void;
    pub type CFArrayRef = *const c_void;
    pub type CFDictionaryRef = *const c_void;
    pub type CFStringRef = *const c_void;
    pub type CFNumberRef = *const c_void;
    pub type CFAllocatorRef = *const c_void;
    pub type CFIndex = isize;

    pub const kCFStringEncodingUTF8: u32 = 0x08000100;
    pub const kCFNumberSInt32Type: u32 = 3;
    pub const kCGWindowListOptionOnScreenOnly: u32 = 1 << 0;
    pub const kCGWindowListExcludeDesktopElements: u32 = 1 << 4;

    #[link(name = "CoreGraphics", kind = "framework")]
    extern "C" {
        pub fn CGWindowListCopyWindowInfo(option: u32, relativeToWindow: u32) -> CFArrayRef;
    }

    #[link(name = "CoreFoundation", kind = "framework")]
    extern "C" {
        pub fn CFArrayGetCount(array: CFArrayRef) -> CFIndex;
        pub fn CFArrayGetValueAtIndex(array: CFArrayRef, idx: CFIndex) -> CFTypeRef;
        pub fn CFDictionaryGetValue(dict: CFDictionaryRef, key: CFTypeRef) -> CFTypeRef;
        pub fn CFRelease(cf: CFTypeRef);
        pub fn CFStringCreateWithCString(
            alloc: CFAllocatorRef,
            c_str: *const i8,
            encoding: u32,
        ) -> CFStringRef;
        pub fn CFStringGetLength(string: CFStringRef) -> CFIndex;
        pub fn CFStringGetCString(
            string: CFStringRef,
            buffer: *mut u8,
            buffer_size: CFIndex,
            encoding: u32,
        ) -> bool;
        pub fn CFNumberGetValue(
            number: CFNumberRef,
            the_type: u32,
            value_ptr: *mut c_void,
        ) -> bool;
    }

    /// Create a CFString from a Rust &str. Caller must CFRelease the result.
    pub unsafe fn make_cf_string(s: &str) -> CFStringRef {
        let c_str = CString::new(s).unwrap();
        CFStringCreateWithCString(std::ptr::null(), c_str.as_ptr(), kCFStringEncodingUTF8)
    }

    /// Convert a CFStringRef to a Rust String. Returns empty string if null.
    pub unsafe fn cf_string_to_rust(cf: CFStringRef) -> String {
        if cf.is_null() {
            return String::new();
        }
        let len = CFStringGetLength(cf);
        let buf_size = len * 4 + 1;
        let mut buf = vec![0u8; buf_size as usize];
        if CFStringGetCString(cf, buf.as_mut_ptr(), buf_size, kCFStringEncodingUTF8) {
            let end = buf.iter().position(|&b| b == 0).unwrap_or(buf.len());
            String::from_utf8_lossy(&buf[..end]).to_string()
        } else {
            String::new()
        }
    }
}

#[cfg(target_os = "macos")]
pub fn get_foreground_window() -> Result<WindowSnapshot, AppError> {
    use macos_ffi::*;
    use std::ffi::c_void;

    unsafe {
        let options = kCGWindowListOptionOnScreenOnly | kCGWindowListExcludeDesktopElements;
        let list = CGWindowListCopyWindowInfo(options, 0);
        if list.is_null() {
            return Err(AppError::WindowDetection(
                "CGWindowListCopyWindowInfo returned null".to_string(),
            ));
        }

        let count = CFArrayGetCount(list);
        let layer_key = make_cf_string("kCGWindowLayer");
        let owner_key = make_cf_string("kCGWindowOwnerName");
        let name_key = make_cf_string("kCGWindowName");

        let mut result: Result<WindowSnapshot, AppError> = Err(AppError::WindowDetection(
            "No foreground window".to_string(),
        ));

        for i in 0..count {
            let dict = CFArrayGetValueAtIndex(list, i);
            if dict.is_null() {
                continue;
            }

            // Only consider normal windows (layer 0)
            let layer_val = CFDictionaryGetValue(dict, layer_key);
            if layer_val.is_null() {
                continue;
            }
            let mut layer: i32 = -1;
            CFNumberGetValue(
                layer_val,
                kCFNumberSInt32Type,
                &mut layer as *mut i32 as *mut c_void,
            );
            if layer != 0 {
                continue;
            }

            // Get application name
            let owner_val = CFDictionaryGetValue(dict, owner_key);
            let owner = cf_string_to_rust(owner_val);

            // Skip system processes
            if owner.is_empty()
                || owner == "Window Server"
                || owner == "SystemUIServer"
                || owner == "Dock"
                || owner == "Spotlight"
                || owner == "Control Center"
            {
                continue;
            }

            // Get window title (may be empty without Screen Recording permission)
            let title_val = CFDictionaryGetValue(dict, name_key);
            let title = cf_string_to_rust(title_val);

            result = Ok(WindowSnapshot {
                title,
                process_name: owner.to_lowercase(),
            });
            break;
        }

        CFRelease(layer_key);
        CFRelease(owner_key);
        CFRelease(name_key);
        CFRelease(list);

        result
    }
}

/// Check if Screen Recording permission is granted on macOS.
/// Attempts to read window titles; if all are empty, permission is likely missing.
#[cfg(target_os = "macos")]
pub fn has_screen_recording_permission() -> bool {
    use macos_ffi::*;
    use std::ffi::c_void;

    unsafe {
        let options = kCGWindowListOptionOnScreenOnly | kCGWindowListExcludeDesktopElements;
        let list = CGWindowListCopyWindowInfo(options, 0);
        if list.is_null() {
            return false;
        }

        let count = CFArrayGetCount(list);
        let layer_key = make_cf_string("kCGWindowLayer");
        let owner_key = make_cf_string("kCGWindowOwnerName");
        let name_key = make_cf_string("kCGWindowName");
        let mut found_title = false;

        for i in 0..count {
            let dict = CFArrayGetValueAtIndex(list, i);
            if dict.is_null() {
                continue;
            }

            let layer_val = CFDictionaryGetValue(dict, layer_key);
            if layer_val.is_null() {
                continue;
            }
            let mut layer: i32 = -1;
            CFNumberGetValue(
                layer_val,
                kCFNumberSInt32Type,
                &mut layer as *mut i32 as *mut c_void,
            );
            if layer != 0 {
                continue;
            }

            let owner_val = CFDictionaryGetValue(dict, owner_key);
            let owner = cf_string_to_rust(owner_val);
            if owner.is_empty()
                || owner == "Window Server"
                || owner == "SystemUIServer"
                || owner == "Dock"
                || owner == "Spotlight"
                || owner == "Control Center"
            {
                continue;
            }

            let title_val = CFDictionaryGetValue(dict, name_key);
            let title = cf_string_to_rust(title_val);
            if !title.is_empty() {
                found_title = true;
                break;
            }
        }

        CFRelease(layer_key);
        CFRelease(owner_key);
        CFRelease(name_key);
        CFRelease(list);

        found_title
    }
}

#[cfg(windows)]
pub fn has_screen_recording_permission() -> bool {
    true // Not needed on Windows
}

/// Get the number of seconds since the last user input (mouse/keyboard).
#[cfg(windows)]
pub fn get_system_idle_secs() -> u64 {
    use windows::Win32::UI::Input::KeyboardAndMouse::{GetLastInputInfo, LASTINPUTINFO};

    unsafe {
        let mut lii = LASTINPUTINFO {
            cbSize: std::mem::size_of::<LASTINPUTINFO>() as u32,
            dwTime: 0,
        };
        if GetLastInputInfo(&mut lii).as_bool() {
            // GetTickCount wraps after ~49 days, but the difference is still correct
            let tick_count = windows::Win32::System::SystemInformation::GetTickCount();
            ((tick_count - lii.dwTime) / 1000) as u64
        } else {
            0
        }
    }
}

/// Get the number of seconds since the last user input (mouse/keyboard).
#[cfg(target_os = "macos")]
pub fn get_system_idle_secs() -> u64 {
    #[link(name = "CoreGraphics", kind = "framework")]
    extern "C" {
        fn CGEventSourceSecondsSinceLastEventType(
            source_state_id: u32,
            event_type: u32,
        ) -> f64;
    }

    // kCGEventSourceStateCombinedSessionState = 0
    const COMBINED_SESSION: u32 = 0;
    // Check multiple event types and take the minimum (most recent activity)
    const MOUSE_MOVED: u32 = 5;
    const KEY_DOWN: u32 = 10;
    const LEFT_MOUSE_DOWN: u32 = 1;
    const SCROLL_WHEEL: u32 = 22;

    unsafe {
        let mouse_idle = CGEventSourceSecondsSinceLastEventType(COMBINED_SESSION, MOUSE_MOVED);
        let key_idle = CGEventSourceSecondsSinceLastEventType(COMBINED_SESSION, KEY_DOWN);
        let click_idle = CGEventSourceSecondsSinceLastEventType(COMBINED_SESSION, LEFT_MOUSE_DOWN);
        let scroll_idle = CGEventSourceSecondsSinceLastEventType(COMBINED_SESSION, SCROLL_WHEEL);

        let min_idle = mouse_idle.min(key_idle).min(click_idle).min(scroll_idle);
        if min_idle < 0.0 { 0 } else { min_idle as u64 }
    }
}

#[cfg(not(any(windows, target_os = "macos")))]
pub fn get_system_idle_secs() -> u64 {
    0 // No idle detection on unsupported platforms
}

#[cfg(not(any(windows, target_os = "macos")))]
pub fn has_screen_recording_permission() -> bool {
    true
}

#[cfg(not(any(windows, target_os = "macos")))]
pub fn get_foreground_window() -> Result<WindowSnapshot, AppError> {
    Err(AppError::WindowDetection(
        "Window detection not supported on this platform".to_string(),
    ))
}
