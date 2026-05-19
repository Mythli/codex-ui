
# 05 Renderer Entrypoints

## HTML Entrypoints
- Webview HTML: `raw/asar/webview/index.html`
- Root element: `#root`
- Script refs: `./assets/index-BCyxq2Zd.js`
- Preload refs: `./assets/preload-helper-DDNUbuXK.js`, `./assets/chunk-Bj-mKKzh.js`, `./assets/path-browserify-fgDTXxoN.js`, `./assets/src-CVmnixyG.js`

## Main/Preload Candidates
| Path | Size |
| --- | --- |
| .vite/build/comment-preload.js | 34.0 MB |
| .vite/build/app-session-tZw_L1R0.js | 4.2 MB |
| .vite/build/worker.js | 1.2 MB |
| .vite/build/main-DnQgBHvi.js | 1.1 MB |
| .vite/build/workspace-root-drop-handler-CVOJlSpQ.js | 836.7 KB |
| .vite/build/bootstrap.js | 3.7 KB |
| .vite/build/trace-recording-sentry-upload-CHIY5YpW.js | 3.3 KB |
| .vite/build/preload.js | 2.3 KB |
| .vite/build/sandbox-preload.js | 1.9 KB |
| webview/assets/preload-helper-DDNUbuXK.js | 1.2 KB |

## Renderer Entry Candidates
| Path | Size | Role | Imports |
| --- | --- | --- | --- |
| webview/assets/app-main-Bucm979x.js | 706.4 KB | main UI shell | ./add-project-menu-items-CCB8uvCz.js, ./alert-c66zJoai.js, ./alert-CMFvnRJe.js, ./ambient-suggestions-connected-apps-consent-Dmy4w8OE.js, ./AnimatePresence-Bct_341s.js, ./animations-y0LC3gHS.js, ./app-connect-oauth-CTRmG4IN.js, ./app-intl-signal-DISS5MMM.js, ./app-server-connection-state-CI4fPGEn.js, ./app-server-manager-hooks-etsxO0Bv.js, ./app-server-manager-signals-C1h8B-R-.js, ./app-shell-iF27Bpcm.js, ./apps-Cel-9d-y.js, ./apps-queries-CcKoLym6.js, ./archive-L27gNihU.js, ./arrow-left-QUFCX6p1.js, ./arrow-up-D-bzg_3v.js, ./automation-dialog-C0I0kVGV.js, ./automation-schedule-DrXsKRHC.js, ./automation-shared-Bwr_Fwvo.js |
| webview/assets/composer-DawxvKsB.js | 1.2 MB | message composer | ./add-project-menu-items-CCB8uvCz.js, ./alert-c66zJoai.js, ./AnimatePresence-Bct_341s.js, ./animations-y0LC3gHS.js, ./app-connect-modal-CdosMTLt.js, ./app-connect-oauth-CTRmG4IN.js, ./app-intl-signal-DISS5MMM.js, ./app-server-connection-state-CI4fPGEn.js, ./app-server-manager-hooks-etsxO0Bv.js, ./app-server-manager-signals-C1h8B-R-.js, ./apps-Cel-9d-y.js, ./apps-queries-CcKoLym6.js, ./arrow-left-QUFCX6p1.js, ./arrow-up-D-bzg_3v.js, ./arrow-up-right-lg-vtVol1Kq.js, ./avatar-BldHceLA.js, ./badge-BAJmBmgK.js, ./banner-BprFAIaH.js, ./branch-UmskMqbY.js, ./browser-use-origin-state-queries-CemUwW0r.js |
| webview/assets/composer-atoms-58_nbOg4.js | 397 B | message composer | ./app-server-manager-signals-C1h8B-R-.js, ./vscode-api-Dc9pX2Bc.js |
| webview/assets/conversation-markdown-DPlbNuUy.js | 14.7 KB | conversation/thread UI | ./skill-path-utils-D37gIe4M.js, ./split-items-into-render-groups-C1Yh6v3t.js |
| webview/assets/dialog-layout-DFbNYVVU.js | 5.6 KB | layout/navigation | ./button-Tcj7k4Zi.js, ./chunk-Bj-mKKzh.js, ./clsx-DUH431RJ.js, ./compiler-runtime-DU4FoEWg.js, ./jsx-runtime-CtnhcczV.js, ./with-window-C87ud2_m.js |
| webview/assets/heartbeat-automation-thread-bridge-ConOBnuP.js | 1.3 KB | conversation/thread UI | ./app-server-manager-signals-C1h8B-R-.js, ./chunk-Bj-mKKzh.js, ./compiler-runtime-DU4FoEWg.js, ./heartbeat-automation-eligibility-BvYGFC_l.js, ./heartbeat-automation-permissions-Dk8gBYrg.js, ./jsx-runtime-CtnhcczV.js, ./statsig-C22dY4zM.js, ./vscode-api-Dc9pX2Bc.js |
| webview/assets/hotkey-window-detail-layout-D35Bu6qG.js | 5.1 KB | layout/navigation | ./button-Tcj7k4Zi.js, ./chunk-Bj-mKKzh.js, ./chunk-LFPYN7LY-Cafl-tZa.js, ./compiler-runtime-DU4FoEWg.js, ./compose-UO9cVYjr.js, ./jsx-runtime-CtnhcczV.js, ./lib-cD1yntXX.js, ./pop-in-mac-Buy1KjOp.js, ./tooltip-DSVJQbko.js, ./use-command-hotkey-BG-2__1e.js, ./use-hotkey-window-detail-layout-CP5iGU1u.js, ./use-hotkey-window-dismiss-on-escape-DqJclkSD.js, ./use-window-controls-safe-area-D9Gglg8Z.js, ./vscode-api-Dc9pX2Bc.js, ./x-DViO876M.js |
| webview/assets/hotkey-window-new-thread-page-CWZ4qkbB.js | 10.1 KB | conversation/thread UI | ./compiler-runtime-DU4FoEWg.js, ./composer-DawxvKsB.js, ./homepage-logo-obINH2ah.js, ./jsx-runtime-CtnhcczV.js, ./lib-cD1yntXX.js, ./src-CVmnixyG.js, ./thread-layout-BwW3n1bx.js, ./thread-scroll-layout-VJkCnmRN.js, ./use-hotkey-window-detail-layout-CP5iGU1u.js, ./vscode-api-Dc9pX2Bc.js |
| webview/assets/hotkey-window-thread-page-CLHQwdO6.js | 11.2 KB | conversation/thread UI | ./app-server-manager-signals-C1h8B-R-.js, ./apps-Cel-9d-y.js, ./chunk-LFPYN7LY-Cafl-tZa.js, ./compiler-runtime-DU4FoEWg.js, ./get-project-name-C-ckXzMj.js, ./heartbeat-automation-thread-bridge-ConOBnuP.js, ./jsx-runtime-CtnhcczV.js, ./lib-cD1yntXX.js, ./local-conversation-thread-C4DDoT1D.js, ./src-CVmnixyG.js, ./use-hotkey-window-detail-layout-CP5iGU1u.js, ./vscode-api-Dc9pX2Bc.js |
| webview/assets/index-BCyxq2Zd.js | 14.1 KB | renderer entry | ./preload-helper-DDNUbuXK.js, ./src-CVmnixyG.js |
| webview/assets/is-subagent-conversation-Ce7kusa7.js | 223 B | conversation/thread UI | ./app-server-manager-signals-C1h8B-R-.js |
| webview/assets/local-conversation-page-BsAzN3YP.js | 37.4 KB | conversation/thread UI | ./animations-y0LC3gHS.js, ./app-server-manager-signals-C1h8B-R-.js, ./app-shell-iF27Bpcm.js, ./apps-Cel-9d-y.js, ./apps-queries-CcKoLym6.js, ./archive-L27gNihU.js, ./automation-schedule-DrXsKRHC.js, ./automation-shared-Bwr_Fwvo.js, ./button-Tcj7k4Zi.js, ./chevron-right-BCtiO3EW.js, ./chunk-Bj-mKKzh.js, ./chunk-LFPYN7LY-Cafl-tZa.js, ./clock-kf8GAqp7.js, ./clsx-DUH431RJ.js, ./command-keybindings-DdeYfYRe.js, ./compiler-runtime-DU4FoEWg.js, ./composer-DawxvKsB.js, ./copy-C__qEEIv.js, ./cube-CmcBPK0o.js, ./dropdown-P0U8o38I.js |
| webview/assets/local-conversation-thread-C4DDoT1D.js | 572.2 KB | conversation/thread UI | ./alert-CMFvnRJe.js, ./AnimatePresence-Bct_341s.js, ./animations-y0LC3gHS.js, ./app-connect-modal-CdosMTLt.js, ./app-intl-signal-DISS5MMM.js, ./app-server-manager-hooks-etsxO0Bv.js, ./app-server-manager-signals-C1h8B-R-.js, ./app-shell-panel-animation-DTiWlXE1.js, ./apps-Cel-9d-y.js, ./apps-queries-CcKoLym6.js, ./archive-L27gNihU.js, ./arrow-left-QUFCX6p1.js, ./arrow-top-right-DH4i9sQ1.js, ./automation-schedule-DrXsKRHC.js, ./automation-shared-Bwr_Fwvo.js, ./avatar-BldHceLA.js, ./badge-BAJmBmgK.js, ./banner-BprFAIaH.js, ./branch-UmskMqbY.js, ./building-C_VYD-7s.js |
| webview/assets/new-thread-panel-page-Cbbd78wa.js | 10.4 KB | conversation/thread UI | ./chunk-LFPYN7LY-Cafl-tZa.js, ./clsx-DUH431RJ.js, ./compiler-runtime-DU4FoEWg.js, ./composer-DawxvKsB.js, ./jsx-runtime-CtnhcczV.js, ./lib-cD1yntXX.js, ./nux-gate-B0fLpkyP.js, ./thread-layout-BwW3n1bx.js |
| webview/assets/pending-worktree-conversation-B0SyRm17.js | 1.8 KB | conversation/thread UI | ./app-server-manager-signals-C1h8B-R-.js, ./logger-DlXCjIgk.js, ./reply-CsVsJnp1.js, ./src-CVmnixyG.js, ./vscode-api-Dc9pX2Bc.js |
| webview/assets/remote-conversation-page-CVUvRFXg.js | 73.1 KB | conversation/thread UI | ./app-server-manager-signals-C1h8B-R-.js, ./app-shell-iF27Bpcm.js, ./apps-Cel-9d-y.js, ./apps-queries-CcKoLym6.js, ./archive-L27gNihU.js, ./arrow-top-right-DH4i9sQ1.js, ./automation-shared-Bwr_Fwvo.js, ./banner-BprFAIaH.js, ./branch-UmskMqbY.js, ./button-Tcj7k4Zi.js, ./check-md-Naxewpxv.js, ./chunk-Bj-mKKzh.js, ./chunk-LFPYN7LY-Cafl-tZa.js, ./clsx-DUH431RJ.js, ./codex-api-B3jrGDqO.js, ./codex-BmAR8R9o.js, ./command-keybindings-DdeYfYRe.js, ./compiler-runtime-DU4FoEWg.js, ./composer-DawxvKsB.js, ./copy-C__qEEIv.js |
| webview/assets/review-conversation-files-model-B36o5VfJ.js | 495 B | conversation/thread UI | ./app-server-manager-signals-C1h8B-R-.js, ./route-scope-DXjTu9dE.js, ./vscode-api-Dc9pX2Bc.js |
| webview/assets/right-panel-composer-overlay-scroll-reserve-DAyqDzTM.js | 1.2 KB | message composer | ./route-scope-DXjTu9dE.js, ./vscode-api-Dc9pX2Bc.js |
| webview/assets/settings-content-layout-jBLQAD2t.js | 2.0 KB | layout/navigation | ./clsx-DUH431RJ.js, ./compiler-runtime-DU4FoEWg.js, ./jsx-runtime-CtnhcczV.js |
| webview/assets/sidebar-project-groups-Be4EWk1a.js | 7.7 KB | layout/navigation | ./_baseEach-BKw9Z6l4.js, ./_defineProperty-hlgkSGfN.js, ./app-server-manager-signals-C1h8B-R-.js, ./chunk-Bj-mKKzh.js, ./logger-DlXCjIgk.js, ./parse-owner-repo-CCQWD2VJ.js, ./sidebar-thread-keys-C68XItB4.js, ./skill-path-utils-D37gIe4M.js, ./src-CVmnixyG.js, ./uniq-BOyUwdI8.js, ./vscode-api-Dc9pX2Bc.js |
| webview/assets/sidebar-signals-B477TzmP.js | 2.1 KB | layout/navigation | ./lib-CaxB7fy8.js, ./vscode-api-Dc9pX2Bc.js |
| webview/assets/sidebar-thread-keys-C68XItB4.js | 2.5 KB | conversation/thread UI | ./chunk-Bj-mKKzh.js, ./compiler-runtime-DU4FoEWg.js, ./global-settings-BacBXO5j.js, ./jsx-runtime-CtnhcczV.js, ./src-CVmnixyG.js, ./use-global-state-jv3LA8DT.js, ./vscode-api-Dc9pX2Bc.js |
| webview/assets/thread-context-inputs-DX2Xd-MS.js | 997 B | conversation/thread UI | ./global-settings-BacBXO5j.js, ./src-CVmnixyG.js, ./vscode-api-Dc9pX2Bc.js |
| webview/assets/thread-detail-level-QM6MvnOC.js | 459 B | conversation/thread UI | ./compiler-runtime-DU4FoEWg.js, ./src-CVmnixyG.js, ./use-configuration-C6s74gHM.js |
| webview/assets/thread-env-icon-CxSzsPrp.js | 4.5 KB | conversation/thread UI | ./clsx-DUH431RJ.js, ./compiler-runtime-DU4FoEWg.js, ./jsx-runtime-CtnhcczV.js, ./lib-cD1yntXX.js, ./macbook-BD4z89lk.js, ./remote-host-globe-icon-CGUTHiEh.js, ./tooltip-DSVJQbko.js, ./vscode-api-Dc9pX2Bc.js, ./worktree-AtsfYsSM.js |
| webview/assets/thread-layout-BwW3n1bx.js | 881 B | conversation/thread UI | ./chunk-Bj-mKKzh.js, ./clsx-DUH431RJ.js, ./jsx-runtime-CtnhcczV.js |
| webview/assets/thread-page-header-ClBAUNCk.js | 1.7 KB | conversation/thread UI | ./compiler-runtime-DU4FoEWg.js, ./jsx-runtime-CtnhcczV.js, ./thread-env-icon-CxSzsPrp.js |
| webview/assets/thread-scroll-layout-VJkCnmRN.js | 6.3 KB | conversation/thread UI | ./app-shell-bottom-panel-scroll-sync-Co7RL-22.js, ./apps-Cel-9d-y.js, ./chunk-Bj-mKKzh.js, ./clsx-DUH431RJ.js, ./compiler-runtime-DU4FoEWg.js, ./create-resize-observer-BeLwZ8ay.js, ./jsx-runtime-CtnhcczV.js, ./proxy-BPlNkzQo.js, ./thread-layout-BwW3n1bx.js, ./use-stable-callback-CEFmF_bK.js |
| webview/assets/thread-side-panel-browser-tab-state-CE2WJzZm.js | 6.5 KB | conversation/thread UI | ./chunk-Bj-mKKzh.js, ./compiler-runtime-DU4FoEWg.js, ./jsx-runtime-CtnhcczV.js, ./keyboard-modifier-state-Cp7nFq_C.js, ./modifiers.esm-DKGvtr6M.js, ./route-scope-DXjTu9dE.js, ./vscode-api-Dc9pX2Bc.js |
| webview/assets/use-active-conversation-id-AihA8Dfz.js | 500 B | conversation/thread UI | ./chunk-LFPYN7LY-Cafl-tZa.js, ./compiler-runtime-DU4FoEWg.js, ./src-CVmnixyG.js |
| webview/assets/use-hotkey-window-detail-layout-CP5iGU1u.js | 479 B | layout/navigation | ./chunk-Bj-mKKzh.js, ./compiler-runtime-DU4FoEWg.js, ./jsx-runtime-CtnhcczV.js |
| webview/assets/use-is-thread-realtime-enabled-DpFAaPG5.js | 488 B | conversation/thread UI | ./app-server-manager-signals-C1h8B-R-.js, ./src-CVmnixyG.js, ./statsig-C22dY4zM.js, ./use-global-state-jv3LA8DT.js |
| webview/assets/use-navigate-to-local-conversation-Ytnpo5Kw.js | 5.5 KB | conversation/thread UI | ./app-intl-signal-DISS5MMM.js, ./app-server-manager-signals-C1h8B-R-.js, ./chunk-Bj-mKKzh.js, ./chunk-LFPYN7LY-Cafl-tZa.js, ./compiler-runtime-DU4FoEWg.js, ./react-dom-CRTD2Qa0.js, ./src-CVmnixyG.js, ./statsig-C22dY4zM.js, ./toast-signal-DqcvhvR0.js, ./use-stable-callback-CEFmF_bK.js, ./vscode-api-Dc9pX2Bc.js |
| webview/assets/use-start-new-conversation-CCjyOv8j.js | 525 B | conversation/thread UI | ./app-server-manager-signals-C1h8B-R-.js, ./compiler-runtime-DU4FoEWg.js, ./use-permissions-mode-BlBKM0eR.js, ./vscode-api-Dc9pX2Bc.js |
