"""Local-only, read-only IDN homoglyph demonstration server.

No authentication pages, network dependencies, data collection or logs.
Python 3.10+ standard library only.
"""
from __future__ import annotations

import html
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

HOST = "127.0.0.1"
PORT = 8765
TEST_CASES = json.loads((Path(__file__).with_name("scenarios.json")).read_text(encoding="utf-8"))
SCENARIOS = {case["ascii_host"]: case for case in TEST_CASES}
SCENARIOS["127.0.0.1"] = TEST_CASES[0]  # diagnostic landing page only

LEVEL = {"high": ("警戒", "high"), "medium": ("注意", "medium"),
         "info": ("IDN", "info"), "none": ("正常", "normal")}


def make_page(case: dict) -> bytes:
    state = case["expectedLevel"]
    level_name, css_name = LEVEL[state]
    real = html.escape(case["unicode_host"])
    ascii_name = html.escape(case["ascii_host"])
    menu = "\n".join(
        f'<a class="scenario" href="http://{html.escape(item["ascii_host"])}:{PORT}/">'
        f'<span class="dot dot-{LEVEL[item["expectedLevel"]][1]}"></span>'
        f'<span class="scenario-name">{html.escape(item["title"])}</span>'
        f'<span class="host">{html.escape(item["unicode_host"])}</span></a>'
        for item in TEST_CASES
    )
    document = f'''<!doctype html>
<html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>DOMAIN GUARDIAN / ローカル検証</title>
<style>
:root {{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#17212c;background:#f1f5f8}}
*{{box-sizing:border-box}}body{{margin:0}}header{{background:#183653;color:white;padding:19px max(24px,calc((100% - 1024px)/2))}}
header strong{{letter-spacing:.06em}}header small{{color:#b9cfdf;margin-left:12px}}
main{{max-width:1024px;margin:36px auto;padding:0 22px 48px}}.eyebrow{{font-weight:700;letter-spacing:.07em;color:#42647b;font-size:12px}}
h1{{font-size:29px;margin:9px 0 12px}}.lead{{color:#4e6170;line-height:1.7}}
.panel{{background:white;border:1px solid #dce4ea;border-radius:12px;padding:27px;margin-top:24px;box-shadow:0 2px 12px #09263e09}}
.host-large{{font:700 clamp(23px,4vw,38px) ui-monospace,SFMono-Regular,Consolas,monospace;word-break:break-all;letter-spacing:-.04em}}
.mono{{font:14px Consolas,monospace;overflow-wrap:anywhere}}.label{{color:#5f7383;font-size:12px;display:block;margin-bottom:8px}}
.badge{{display:inline-block;border-radius:7px;padding:6px 10px;font-weight:bold;font-size:12px;margin-bottom:18px}}
.badge-high{{color:#a11b1b;background:#ffebeb}}.badge-medium{{color:#8a5805;background:#fff4d5}}
.badge-info{{color:#195d95;background:#e2f2ff}}.badge-normal{{color:#1f6444;background:#e6f7ee}}
.pair{{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin:24px 0}}.pair>div{{padding:13px;background:#f7f9fb;border-radius:8px;min-width:0}}
.notice{{background:#fff6e4;border-left:4px solid #ca8932;padding:13px 17px;line-height:1.7;font-size:14px}}
.links{{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}}
.scenario{{border:1px solid #d9e2e8;border-radius:9px;padding:15px;text-decoration:none;color:#18293a;display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap}}
.scenario:hover{{border-color:#5186ac;background:#f5faff}}.scenario-name{{font-size:13px;font-weight:650;flex:1 1 72%}}.host{{font:12px Consolas,monospace;color:#617786;flex:1 1 100%;padding-left:18px;word-break:break-all}}
.dot{{height:9px;width:9px;border-radius:50%;margin-top:5px;flex:0 0 9px}}.dot-high{{background:#d83e3e}}.dot-medium{{background:#df9b25}}.dot-info{{background:#358bd2}}.dot-normal{{background:#31956a}}
footer{{font-size:12px;color:#637887;margin-top:20px;line-height:1.7}}@media(max-width:600px){{.links,.pair{{grid-template-columns:1fr}}header small{{display:block;margin-left:0}}}}
</style></head><body>
<header><strong>DOMAIN GUARDIAN</strong><small>OFFLINE HOMOGLYPH LAB — 疑似ドメインの実地検証</small></header>
<main><div class="eyebrow">LOCAL TEST / 127.0.0.1 ONLY</div>
<h1>アドレスバーの文字を検証する</h1>
<p class="lead">このページはWindows PC内のテストサーバが表示しています。<b>実在する企業・サイトとは無関係</b>です。<br>
ページの文章ではなく、<b>ブラウザのURL（ドメイン名）</b>を拡張機能で検査してください。</p>
<section class="panel"><span class="badge badge-{css_name}">検出期待値：{level_name}</span>
<span class="label">このページの想定ドメイン（Unicode表記）</span><div class="host-large">{real}</div>
<p class="lead">{html.escape(case["detail"])}</p>
<div class="pair"><div><span class="label">ドメインのUnicode表記</span><div class="mono">{real}</div></div>
<div><span class="label">DNS上のASCII表記（Punycode）</span><div class="mono">{ascii_name}</div></div></div>
<div class="notice"><b>検証手順：</b>移動前確認を有効にすると、国際化ドメインのリンクに目印が付き、クリック時に移動前の確認画面が出ます。
URLを直接開いた場合は、読み込み開始後に画面を覆って検査します。ツールバーのバッジは「自動監視」を別に有効にすると表示されます。
ChromeがURLを <b>xn--</b> 表記にする場合もあります。</div></section>
<section class="panel"><h2 style="font-size:18px;margin-top:0">テストケースを切り替える</h2>
<div class="links">{menu}</div></section>
<footer>通信先は 127.0.0.1:{PORT}。このサイトはフォーム・スクリプト・外部画像を持たず、入力情報を要求・保存しません。
検出期待値は試作エンジン用であり、詐欺サイトの断定ではありません。</footer></main></body></html>'''
    return document.encode("utf-8")


class LocalHandler(BaseHTTPRequestHandler):
    server_version = "DomainGuardianLab/0.1"
    sys_version = ""

    def log_message(self, format: str, *args: object) -> None:
        pass  # No visited URL or request logging.

    def _respond(self, head_only: bool = False) -> None:
        host = self.headers.get("Host", "").split(":", 1)[0].lower().rstrip(".")
        if host not in SCENARIOS:
            self.send_error(421, "Unrecognized test hostname")
            return
        if urlsplit(self.path).path == "/favicon.ico":
            self.send_response(204)
            self.end_headers()
            return
        data = make_page(SCENARIOS[host])
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'")
        self.end_headers()
        if not head_only:
            self.wfile.write(data)

    def do_GET(self) -> None:
        self._respond()

    def do_HEAD(self) -> None:
        self._respond(head_only=True)

    def do_POST(self) -> None:
        self.send_error(405, "This is a read-only test site")


def create_server(port: int = PORT) -> ThreadingHTTPServer:
    return ThreadingHTTPServer((HOST, port), LocalHandler)


def main() -> None:
    with create_server() as server:
        print(f"[DomainGuardianLab] 127.0.0.1:{PORT} で起動しました。", flush=True)
        print("外部公開なし・通信ログ保存なし。終了は Ctrl+C またはこの窓を閉じてください。", flush=True)
        try:
            server.serve_forever(poll_interval=0.2)
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
