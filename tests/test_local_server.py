"""Standard-library integration checks for local-only demo site."""
import http.client
import json
import pathlib
import threading
import unittest
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'test-site'))
from test_server import TEST_CASES, create_server  # noqa: E402


class LocalServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = create_server(0)
        cls.port = cls.server.server_port
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=2)

    def request(self, host, method='GET'):
        client = http.client.HTTPConnection('127.0.0.1', self.port, timeout=2)
        try:
            client.request(method, '/', headers={'Host': host})
            response = client.getresponse()
            data = response.read()
            return response.status, response.headers, data
        finally:
            client.close()

    def test_every_host_served_as_actual_host_header(self):
        for test_case in TEST_CASES:
            with self.subTest(test_case['id']):
                code, headers, data = self.request(test_case['ascii_host'])
                self.assertEqual(code, 200)
                self.assertIn(test_case['unicode_host'], data.decode('utf-8'))
                self.assertIn('default-src', headers['Content-Security-Policy'])
                self.assertEqual(headers['Cache-Control'], 'no-store')
                self.assertNotIn('<form', data.decode('utf-8').lower())
                self.assertNotIn('<script', data.decode('utf-8').lower())

    def test_server_rejects_unrecognized_hosts_and_post(self):
        self.assertEqual(self.request('evil.example')[0], 421)
        self.assertEqual(self.request('paypal.test', 'POST')[0], 405)

    def test_server_is_loopback_only(self):
        self.assertEqual(self.server.server_address[0], '127.0.0.1')


if __name__ == '__main__':
    unittest.main()
