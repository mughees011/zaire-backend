ZAIRE Runtime Package (Windows)
================================

This package contains only compiled runtime assets required to launch ZAIRE.

How to launch
-------------
Double-click launch_zaire.bat

What is included
----------------
- Bundled ZAIRE launcher binary (zaire_boot.exe)
- Bundled ZAIRE daemon router binary (zaire_core.exe)
- Bundled Node runtime (runtime/node.exe)
- Compiled, minified backend bundle (bundle.js)
- Runtime static frontend assets

What is intentionally excluded
------------------------------
- Raw backend JavaScript source files
- Route, middleware, and service source files
- Raw Python source
- Scratch and test files
- Local logs
- Secret files such as .env and OAuth client secrets
- Development node_modules (devDependencies stripped)

Support note
------------
This package assumes your production license endpoint is configured in the launcher before release.
