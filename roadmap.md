# Al-Ahsan AI roadmap

- [x] gpt-engineer adaptation: structured files, safe ZIP, edit/copy workspace and refinement context; 8 regression tests passed, signed-in generation (main.py/test_main.py), edited ZIP download and saved-output mobile check verified. Python CLI execution is not included.
- [ ] Live AI refinement response verification — request composer carries edited sources; additional live test blocked by upstream primary-key 504 timeout (app response 502). No model/provider changes made.

- [x] Email sign-in was disabled on the remixed backend — enabled; test signup returns confirmation_sent_at (real inbox delivery pending manual check)
- [x] Password reset (forgot link + /reset-password page) — pending manual email check
- [x] Phase 4: stop/regenerate/copy/edit message; regenerate no longer double-saves the question (signed-in click test pending)
- [x] Phase 5: model picker in chat (auto + allowed list, server-validated)
- [x] Phase 6–8: image (5), PDF/Word files, image generation, mic + voice reply (already existed, audited)
- [ ] Phase 8–9: voice / live
- [x] Phase 10–12: study / writing / coding mode picker
- [ ] Phase 13–15: builders, workspace
- [x] Phase 16: web search (already existed, audited)
- [x] Phase 17/35: /profile page — account info, memories view/delete, delete all chats
- [x] Phase 18: admin panel (already existed)
- [ ] Phase 19–22: security, performance, mobile, regression
