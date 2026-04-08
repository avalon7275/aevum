#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    aevum_lib::crash_reporter::install_panic_hook();
    aevum_lib::run()
}
