# raycastard
Raycasting engine - TypeScript / JavaScript / NodeJS

Wall-only raycasting to a 24-bit buffer, then converted to ASCII and displayed using Terminal-Kit npm package.

Clone/Download the repo, run "npm update" to get the reqs, then run "node raycaster.js" in a console window.

Windows console doesn't support 24-bit colors, so you are limited to 256 or somewhere around there. Windows 10 console shows the cursor moving during passes, so it's hilarious to watch how slow the refresh rate it. Windows 7 looks the best on the Windows platform. Linux has nicer colors.

Modify display.js(.ts) to change the characters used.

Make sure you are running the latest version of Node.js.

![alt tag](https://raw.githubusercontent.com/gregfrazier/raycastard/master/sampleWindows.jpg)
![alt tag](https://raw.githubusercontent.com/gregfrazier/raycastard/master/sampleLinux.jpg)
