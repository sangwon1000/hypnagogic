#!/usr/bin/env python3
"""Range 지원 정적 서버 — `python -m http.server`는 Range를 몰라서 브라우저가
비디오를 '시킹 불가'로 취급한다 (밤 첫 화면이 낮 0초 프레임에 갇히던 버그의 뿌리,
사파리가 아예 재생을 거부하던 것도 같은 뿌리). 사용: python3 serve.py <port> [dir]"""
import os
import re
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

RANGE_RE = re.compile(r"bytes=(\d*)-(\d*)$")


class RangeHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Cache-Control", "no-cache")  # dev — 매 로드가 서버를 거쳐야 실서버와 같은 조건
        super().end_headers()

    def do_GET(self):
        rng = self.headers.get("Range")
        path = self.translate_path(self.path)
        if rng and os.path.isfile(path):
            m = RANGE_RE.match(rng.strip())
            if m and self.serve_range(path, *m.groups()):
                return
        super().do_GET()

    def serve_range(self, path, a, b):
        try:
            size = os.path.getsize(path)
        except OSError:
            return False
        if a == "" and b == "":
            return False
        if a == "":  # suffix range: 마지막 N바이트
            start, end = max(0, size - int(b)), size - 1
        else:
            start = int(a)
            end = int(b) if b else size - 1
        if start >= size:
            self.send_response(416)
            self.send_header("Content-Range", "bytes */%d" % size)
            self.end_headers()
            return True
        end = min(end, size - 1)
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Range", "bytes %d-%d/%d" % (start, end, size))
        self.send_header("Content-Length", str(end - start + 1))
        self.end_headers()
        try:
            with open(path, "rb") as f:
                f.seek(start)
                remaining = end - start + 1
                while remaining > 0:
                    chunk = f.read(min(65536, remaining))
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    remaining -= len(chunk)
        except (BrokenPipeError, ConnectionResetError):
            pass
        return True


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    directory = sys.argv[2] if len(sys.argv) > 2 else os.getcwd()
    handler = partial(RangeHandler, directory=directory)
    with ThreadingHTTPServer(("", port), handler) as httpd:
        print("serving %s on http://localhost:%d (Range OK)" % (directory, port), flush=True)
        httpd.serve_forever()


if __name__ == "__main__":
    main()
