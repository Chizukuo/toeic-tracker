async function test_iciba() {
  const url = "https://dict.iciba.com/dictionary/word/suggestion?word=hello";
  try {
    const res = await globalThis.fetch(url);
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(e);
  }
}

test_iciba();
