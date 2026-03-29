const fetch = require('node-fetch'); // or just global fetch in recent node

async function test_translate() {
  const url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&dt=bd&q=hello";
  try {
    const res = await fetch(url);
    const text = await res.text();
    console.log(text);
  } catch (e) {
    console.error(e);
  }
}

test_translate();
