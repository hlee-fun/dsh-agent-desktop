import("./lib/index.js").then(async (m) => {
  const tools = {};
  const ctx = {
    on: (event, handler) => {
      if (event === "tools/register") {
        const registry = {
          register: (ns, fns) => { tools[ns] = fns; }
        };
        handler(registry);
      }
    },
    effect: () => {}
  };
  m.default(ctx);
  const ad = tools.agent_desktop;

  // 1. list_windows to find DSH window
  console.log("=== list_windows ===");
  const wins = await ad.list_windows({ app: "DeepSeek Harness" });
  const winId = wins.data?.[0]?.id;
  console.log("DSH window:", winId, wins.data?.[0]?.title);

  // 2. snapshot with --window-id
  console.log("\n=== snapshot --window-id ===");
  const snap = await ad.snapshot({ windowId: winId });
  console.log("snapshot ok:", snap.ok, "refs:", snap.data?.ref_count);
  const tree = JSON.stringify(snap);

  // 3. Find textfield refs
  const allRefs = tree.match(/@s[\w]+:e\d+/g) || [];
  console.log("total refs:", allRefs.length);

  // Extract textfield refs by parsing JSON tree
  const findTextfields = (node, out) => {
    if (node && node.role) {
      const role = String(node.role || "");
      if (/textfield|edit/i.test(role) && node.ref_id) {
        out.push(node.ref_id);
      }
    }
    for (const c of (node && node.children ? node.children : [])) findTextfields(c, out);
  };
  const textfields = [];
  findTextfields(snap.data?.tree, textfields);
  console.log("textfield refs:", textfields);

  // 4. Test status
  console.log("\n=== status ===");
  const status = await ad.status();
  console.log("ok:", status.ok, "platform:", status.data?.platform);

  // 5. Test type_text on first textfield
  if (textfields.length > 0) {
    console.log("\n=== type_text (headed) ===");
    try {
      const type = await ad.type_text({ ref: textfields[0], text: "hello world" });
      console.log("type_text ok:", type.ok, type.data?.post_state?.value || type.error?.message?.substring(0,100));
    } catch (e) {
      console.error("type_text error:", e.message.substring(0, 200));
    }
  }

  // 6. Test click on first ref
  console.log("\n=== click ===");
  try {
    const click = await ad.click({ ref: allRefs[0] });
    console.log("click ok:", click.ok);
  } catch (e) {
    console.error("click error:", e.message.substring(0, 200));
  }

  // 7. Test screenshot --window-id
  console.log("\n=== screenshot --window-id ===");
  try {
    const ss = await ad.screenshot({ windowId: winId });
    console.log("screenshot ok:", ss.ok, "base64 len:", ss.data?.data?.length || 0);
  } catch (e) {
    console.error("screenshot error:", e.message.substring(0, 200));
  }

  // 8. Test find
  console.log("\n=== find (role=button) ===");
  try {
    const f = await ad.find({ role: "button" });
    console.log("find ok:", f.ok, "count:", f.data?.length || f.data?.elements?.length || 0);
  } catch (e) {
    console.error("find error:", e.message.substring(0, 200));
  }

  // 9. Test get
  console.log("\n=== get (first ref) ===");
  try {
    const g = await ad.get({ ref: allRefs[0], property: "text" });
    console.log("get ok:", g.ok, "value:", g.data?.value?.substring(0, 50));
  } catch (e) {
    console.error("get error:", e.message.substring(0, 200));
  }

  // 10. Test clipboard_get
  console.log("\n=== clipboard_get ===");
  try {
    const cp = await ad.clipboard_get();
    console.log("clipboard ok:", cp.ok, "value:", cp.data?.data?.substring(0, 50) || cp.data?.value);
  } catch (e) {
    console.error("clipboard error:", e.message.substring(0, 200));
  }

  // 11. Test press (escape)
  console.log("\n=== press (escape) ===");
  try {
    const p = await ad.press({ key: "escape" });
    console.log("press ok:", p.ok);
  } catch (e) {
    console.error("press error:", e.message.substring(0, 200));
  }

  // 12. Test scroll
  console.log("\n=== scroll (first ref, down) ===");
  try {
    const sc = await ad.scroll({ ref: allRefs[0], direction: "down", amount: 1 });
    console.log("scroll ok:", sc.ok);
  } catch (e) {
    console.error("scroll error:", e.message.substring(0, 200));
  }

  // 13. Test set_value
  if (textfields.length > 0) {
    console.log("\n=== set_value ===");
    try {
      const sv = await ad.set_value({ ref: textfields[0], value: "set-value-test" });
      console.log("set_value ok:", sv.ok, sv.error?.message?.substring(0, 80) || "");
    } catch (e) {
      console.error("set_value error:", e.message.substring(0, 200));
    }
  }

  console.log("\n=== Done ===");
}).catch(e => console.error("Module load error:", e.message));
