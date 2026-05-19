# Runtime Notes

- Launched `/Applications/Codex.app` via `open -a Codex`.
- Could not read Codex window bounds through AppleScript: Command failed: osascript -e tell application "System Events"
  tell process "Codex"
    set frontmost to true
    if (count of windows) is 0 then error "No Codex windows found"
    set w to window 1
    set p to position of w
    set s to size of w
    return (item 1 of p as text) & "," & (item 2 of p as text) & "," & (item 1 of s as text) & "," & (item 2 of s as text)
  end tell
end tell
90:106: execution error: System Events got an error: osascript is not allowed assistive access. (-25211)

- Skipped screenshot because no valid Codex window bounds were available.

## Runtime Capture Limitations
- This helper captures the visible native window, not internal React component state.
- DOM and computed-style extraction requires attaching to Electron DevTools/CDP or using an app-supported debug build.
