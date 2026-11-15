const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
function load(file, mocks = {}) {
  const mod = { exports: {} };
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(output, { module: mod, exports: mod.exports, URL, require: name => mocks[name] || require(name) });
  return mod.exports;
}
const youtube = load('lib/youtube-video.ts');
const id = 'M7lc1UVf-VE';
test('normalizes watch, shared, mobile, shorts, live and embed links', () => {
  for (const url of [
    `https://www.youtube.com/watch?v=${id}&t=23`,
    ` https://youtu.be/${id}?si=shared `,
    `https://m.youtube.com/watch?v=${id}`,
    `https://youtube.com/shorts/${id}`,
    `https://www.youtube.com/live/${id}`,
    `https://www.youtube-nocookie.com/embed/${id}?rel=0`,
  ]) {
    assert.equal(youtube.getYouTubeVideoId(url), id);
    assert.equal(youtube.normalizeYouTubeVideoUrl(url), `https://www.youtube.com/watch?v=${id}`);
    assert.equal(youtube.getYouTubeEmbedUrl(url), `https://www.youtube-nocookie.com/embed/${id}?playsinline=1&rel=0`);
  }
});
test('rejects arbitrary origins, lookalikes, scripts, playlists and invalid video IDs', () => {
  for (const url of [
    '', null, '/videos/local.mp4', 'https://cdn.example/video.mp4',
    `https://youtube.com.evil.example/watch?v=${id}`,
    `https://youtube.com@evil.example/watch?v=${id}`,
    `javascript:alert(1)`, `ftp://youtube.com/watch?v=${id}`,
    `https://youtube.com/playlist?list=${id}`, 'https://youtu.be/short',
    `https://youtube.com/embed/${id}/extra`, `https://youtube.com/watch?v=%22%3E%3Cscript%3E`,
  ]) assert.equal(youtube.getYouTubeVideoId(url), null, String(url));
});
const { ViewportVideo } = load('components/viewport-video.tsx', { '@/lib/youtube-video': youtube });
test('YouTube renders an inline iframe with controls and full-screen access, not an outbound link or video element', () => {
  const html = renderToStaticMarkup(React.createElement(ViewportVideo, {
    src: `https://youtu.be/${id}`, className: 'aspect-video w-full', 'aria-label': 'Video de la propiedad', autoPlay: true, muted: true, loop: true,
  }));
  assert.match(html, /^<iframe/);
  assert.match(html, /youtube-nocookie.com\/embed\/M7lc1UVf-VE/);
  assert.match(html, /title="Video de la propiedad"/);
  assert.match(html, /autoplay=1/);
  assert.match(html, /mute=1/);
  assert.match(html, /loop=1/);
  assert.match(html, /playlist=M7lc1UVf-VE/);
  assert.match(html, /allowfullscreen/);
  assert.match(html, /referrerPolicy="strict-origin-when-cross-origin"/i);
  assert.doesNotMatch(html, /<a\b|<video\b|target=|controls=0/);
});
test('uploaded videos retain the native lazy-loading video path and their playback props', () => {
  const html = renderToStaticMarkup(React.createElement(ViewportVideo, {
    src: 'https://cdn.example/video.mp4', poster: '/cover.jpg', controls: true, muted: true, className: 'aspect-video w-full',
  }));
  assert.match(html, /^<video/);
  assert.match(html, /controls=""/);
  assert.match(html, /poster="\/cover.jpg"/);
  assert.doesNotMatch(html, /<iframe/);
});

test('admin previews stay manual while public autoplay is always muted', () => {
  const manual = renderToStaticMarkup(React.createElement(ViewportVideo, {src: `https://youtu.be/${id}`, controls: true}));
  assert.doesNotMatch(manual, /autoplay=1/);
  const autoplay = youtube.getYouTubeEmbedUrl(`https://youtu.be/${id}`, {autoPlay: true, muted: false});
  assert.match(autoplay, /autoplay=1&mute=1/);
});
