import("./lib/index.js").then(async (m) => {
  const tools = {};
  const ctx = { on: (e,h) => { if (e==='tools/register') h({ register: (ns,f) => { tools[ns] = f; } }); }, effect: () => {} };
  m.default(ctx);
  const ad = tools.agent_desktop;
  const results = [];
  const winList = await ad.list_windows({ app: "DeepSeek Harness" });
  // DSH can expose several windows (tooltips/popups); the main window is the
  // large one (chat input only exists there).
  const big = (winList.data || []).filter(w => w.bounds && w.bounds.width > 800 && w.bounds.height > 500);
  const WIN_ID = big.length ? big[0].id : undefined;
  console.log("DSH window id:", WIN_ID);

  // Fresh snapshot for all ref-based tests
  const snap = await ad.snapshot({ windowId: WIN_ID });
  const sid = snap.data.snapshot_id;
  console.log("Fresh snapshot:", sid, "refs:", snap.data.ref_count);

  // Collect refs by type
  const buttons = [], textfields = [], scrollables = [], selectables = [];
  const walk = (node) => {
    if (node?.role && node?.ref_id) {
      const role = String(node.role);
      const actions = node.available_actions || [];
      if (/button/i.test(role)) buttons.push(node.ref_id);
      if (/textfield|edit/i.test(role)) textfields.push(node.ref_id);
      if (actions.includes('Scroll')) scrollables.push(node.ref_id);
      if (/listbox|combo|menuitem/i.test(role)) selectables.push(node.ref_id);
    }
    for (const c of (node?.children || [])) walk(c);
  };
  walk(snap.data?.tree);
  console.log("buttons:", buttons.length, "textfields:", textfields.length, "scrollables:", scrollables.length, "selectables:", selectables.length);

  // 1. status
  console.log("\n=== 1. status ===");
  try { const r = await ad.status(); results.push(['status', r.ok, '']); console.log("OK", r.data?.platform); }
  catch(e) { results.push(['status', false, e.message.slice(0,80)]); console.log("FAIL"); }

  // 2. list_windows
  console.log("\n=== 2. list_windows ===");
  try { const r = await ad.list_windows({ app: "DeepSeek Harness" }); results.push(['list_windows', r.ok, '']); console.log("OK", r.data?.[0]?.id); }
  catch(e) { results.push(['list_windows', false, e.message.slice(0,80)]); console.log("FAIL"); }

  // 3. snapshot (already done above)
  results.push(['snapshot', true, '']);
  console.log("\n=== 3. snapshot === OK", snap.data.ref_count);

  // 4. find
  console.log("\n=== 4. find (role=button) ===");
  try { const r = await ad.find({ role: "button" }); results.push(['find', r.ok, '']); console.log("OK"); }
  catch(e) { results.push(['find', false, e.message.slice(0,80)]); console.log("FAIL"); }

  // 5. get (fresh ref)
  console.log("\n=== 5. get ===");
  try { const r = await ad.get({ ref: buttons[0], property: 'text' }); results.push(['get', r.ok, '']); console.log("OK value:", r.data?.value?.slice(0,30)); }
  catch(e) { results.push(['get', false, e.message.slice(0,80)]); console.log("FAIL", e.message.slice(0,80)); }

  // 6. click (fresh ref)
  console.log("\n=== 6. click ===");
  try { const r = await ad.click({ ref: buttons[0] }); results.push(['click', r.ok, '']); console.log("OK"); }
  catch(e) { results.push(['click', false, e.message.slice(0,80)]); console.log("FAIL", e.message.slice(0,80)); }

  // 7. type_text --headed (prefer the real chat input over the search box)
  console.log("\n=== 7. type_text (--headed + auto pre-focus) ===");
  try {
    let typedRef = textfields[0];
    const chatField = [];
    const walkC = (n) => { if (n?.ref_id && /textfield/i.test(String(n.role)) && /发消息|发送|输入/.test(String(n.name||''))) chatField.push(n.ref_id); for (const c of (n?.children||[])) walkC(c); };
    walkC(snap.data?.tree);
    if (chatField.length > 0) typedRef = chatField[0];
    if (textfields.length > 0) {
      const r = await ad.type_text({ ref: typedRef, text: 'full-test' });
      results.push(['type_text', r.ok, r.error?.code || '']);
      console.log(r.ok ? "OK" : "FAIL", r.error?.code || '');
    } else { results.push(['type_text', false, 'no textfield']); console.log("SKIP"); }
  } catch(e) { results.push(['type_text', false, e.message.slice(0,80)]); console.log("FAIL"); }

  // 8. set_value (fresh textfield ref)
  console.log("\n=== 8. set_value ===");
  try {
    if (textfields.length > 0) {
      const r = await ad.set_value({ ref: textfields[0], value: 'sv-test' });
      results.push(['set_value', r.ok, r.error?.code || '']);
      console.log(r.ok ? "OK" : "FAIL", r.error?.code || '');
    } else { results.push(['set_value', false, 'no textfield']); console.log("SKIP"); }
  } catch(e) { results.push(['set_value', false, e.message.slice(0,80)]); console.log("FAIL"); }

  // 9. screenshot --window-id
  console.log("\n=== 9. screenshot --window-id ===");
  try { const r = await ad.screenshot({ windowId: WIN_ID }); results.push(['screenshot', r.ok, '']); console.log("OK len:", r.data?.data?.length); }
  catch(e) { results.push(['screenshot', false, e.message.slice(0,80)]); console.log("FAIL"); }

  // 10. focus (window-level)
  console.log("\n=== 10. focus (window-level) ===");
  try { const r = await ad.focus({ app: "DeepSeek Harness" }); results.push(['focus', r.ok, r.error?.code || '']); console.log(r.ok ? "OK" : "FAIL", r.error?.code || ''); }
  catch(e) { results.push(['focus', false, e.message.slice(0,80)]); console.log("FAIL"); }

  // 11. focus_element (fresh textfield ref)
  console.log("\n=== 11. focus_element ===");
  try {
    if (textfields.length > 0) {
      const r = await ad.focus_element({ ref: textfields[0] });
      results.push(['focus_element', r.ok, r.error?.code || '']);
      console.log(r.ok ? "OK" : "FAIL", r.error?.code || '');
    } else { results.push(['focus_element', false, 'no textfield']); console.log("SKIP"); }
  } catch(e) { results.push(['focus_element', false, e.message.slice(0,80)]); console.log("FAIL"); }

  // 12. press
  console.log("\n=== 12. press (escape) ===");
  try { const r = await ad.press({ key: "escape" }); results.push(['press', r.ok, '']); console.log("OK"); }
  catch(e) { results.push(['press', false, e.message.slice(0,80)]); console.log("FAIL"); }

  // 13. scroll (fresh scrollable ref)
  console.log("\n=== 13. scroll ===");
  try {
    if (scrollables.length > 0) {
      const r = await ad.scroll({ ref: scrollables[scrollables.length-1], direction: 'down', amount: 1 });
      results.push(['scroll', r.ok, r.error?.code || '']);
      console.log(r.ok ? "OK" : "FAIL", r.error?.code || '');
    } else { results.push(['scroll', false, 'no scrollable']); console.log("SKIP"); }
  } catch(e) { results.push(['scroll', false, e.message.slice(0,80)]); console.log("FAIL"); }

  // 14. clipboard_get
  console.log("\n=== 14. clipboard_get ===");
  try { const r = await ad.clipboard_get(); results.push(['clipboard_get', r.ok, '']); console.log("OK"); }
  catch(e) { results.push(['clipboard_get', false, e.message.slice(0,80)]); console.log("FAIL"); }

  // 15. clipboard_set
  console.log("\n=== 15. clipboard_set ===");
  try { const r = await ad.clipboard_set({ text: "dsh-test-clip" }); results.push(['clipboard_set', r.ok, '']); console.log("OK"); }
  catch(e) { results.push(['clipboard_set', false, e.message.slice(0,80)]); console.log("FAIL"); }

  // 16. wait (time-based, 500ms)
  console.log("\n=== 16. wait (500ms time) ===");
  try { const r = await ad.wait({ timeout: 500 }); results.push(['wait', r.ok, '']); console.log("OK"); }
  catch(e) {
    // Try with --timeout flag via raw args
    console.log("Retry with element wait...");
    const r2 = await ad.wait({ element: buttons[0], timeout: 2000 });
    results.push(['wait', r2.ok, r2.error?.code || '']);
    console.log(r2.ok ? "OK (element)" : "FAIL", r2.error?.code || '');
  }

  // 17. select
  console.log("\n=== 17. select ===");
  try {
    if (selectables.length > 0) {
      const r = await ad.select({ ref: selectables[0], value: '默认' });
      results.push(['select', r.ok, r.error?.code || '']);
      console.log(r.ok ? "OK" : "FAIL", r.error?.code || '');
    } else { results.push(['select', false, 'no selectable']); console.log("SKIP no selectable in DSH window"); }
  } catch(e) { results.push(['select', false, e.message.slice(0,80)]); console.log("FAIL"); }

  // Summary
  console.log("\n========== SUMMARY ==========");
  let pass = 0, fail = 0, skip = 0;
  results.forEach(([name, ok, err]) => {
    const status = ok ? '✅' : err === 'SKIP' ? '⏭️' : '❌';
    console.log(status, name, err ? '(' + err + ')' : '');
    if (ok) pass++; else if (err === 'SKIP' || err === 'no selectable' || err === 'no textfield' || err === 'no scrollable') skip++; else fail++;
  });
  console.log("\nTotal: " + results.length + " | Pass: " + pass + " | Fail: " + fail + " | Skip: " + skip);
}).catch(e => console.error("ERR:", e.message));