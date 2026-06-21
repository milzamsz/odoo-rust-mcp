use std::path::Path;
use std::process::Command;
use std::time::SystemTime;

fn main() {
    let ui_sources = [
        Path::new("../config-ui/src"),
        Path::new("../config-ui/public"),
        Path::new("../config-ui/index.html"),
        Path::new("../config-ui/package.json"),
        Path::new("../config-ui/vite.config.ts"),
    ];
    let ui_dist = Path::new("static/dist");

    // Tell Cargo to rerun this script if any UI source file changes
    println!("cargo:rerun-if-changed=../config-ui/src");
    println!("cargo:rerun-if-changed=../config-ui/public");
    println!("cargo:rerun-if-changed=../config-ui/index.html");
    println!("cargo:rerun-if-changed=../config-ui/package.json");
    println!("cargo:rerun-if-changed=../config-ui/vite.config.ts");
    println!("cargo:rerun-if-changed=../config-ui/tailwind.config.js");
    println!("cargo:rerun-if-changed=../config-ui/tsconfig.json");

    // Only rebuild if UI source is newer than dist output
    if ui_sources_newer_than_dist(&ui_sources, ui_dist) {
        eprintln!("build.rs: UI source changed — running npm run build...");

        // Check npm is available
        let npm_cmd = if cfg!(target_os = "windows") {
            "npm.cmd"
        } else {
            "npm"
        };

        let status = Command::new(npm_cmd)
            .args(["run", "build"])
            .current_dir("../config-ui")
            .status()
            .unwrap_or_else(|e| panic!("Failed to run 'npm run build': {e}\nMake sure Node.js is installed and config-ui deps are installed (npm ci)."));

        if !status.success() {
            panic!("npm run build failed with exit code: {status}");
        }

        eprintln!("build.rs: UI build complete.");
    }
}

/// Returns true if any UI source path is newer than any file under `dist_dir`,
/// or if `dist_dir` does not exist / is empty.
fn ui_sources_newer_than_dist(source_paths: &[&Path], dist_dir: &Path) -> bool {
    let dist_mtime = newest_mtime(dist_dir);
    if dist_mtime.is_none() {
        return true; // dist missing or empty — must build
    }
    let dist_mtime = dist_mtime.unwrap();
    let src_mtime = source_paths
        .iter()
        .filter_map(|path| newest_mtime(path))
        .max();
    src_mtime.map(|t| t > dist_mtime).unwrap_or(false)
}

fn newest_mtime(path: &Path) -> Option<SystemTime> {
    if !path.exists() {
        return None;
    }
    if path.is_file() {
        return path.metadata().ok()?.modified().ok();
    }
    let mut newest: Option<SystemTime> = None;
    visit_dir(path, &mut newest);
    newest
}

fn visit_dir(dir: &Path, newest: &mut Option<SystemTime>) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            visit_dir(&path, newest);
        } else if let Ok(meta) = std::fs::metadata(&path)
            && let Ok(mtime) = meta.modified()
            && newest.map(|n| mtime > n).unwrap_or(true)
        {
            *newest = Some(mtime);
        }
    }
}
