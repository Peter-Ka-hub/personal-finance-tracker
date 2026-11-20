import json
import unittest

from firewall_config import parse_firewall_config


class FirewallConfigTest(unittest.TestCase):
    def setUp(self):
        self.egress = {
            "name": "test-egress",
            "startIpAddress": "192.0.2.1",
            "endIpAddress": "192.0.2.1",
        }

    def test_allows_overlap_without_rules_and_restricted_with_explicit_rules(self):
        for config in (
            {"mode": "overlap", "rules": []},
            {"mode": "restricted", "rules": [self.egress]},
        ):
            self.assertEqual(parse_firewall_config(json.dumps(config)), config)

    def test_rejects_missing_configuration_or_empty_restricted_mode(self):
        for raw in (None, "not json", '{"mode":"restricted","rules":[]}'):
            with self.subTest(raw=raw), self.assertRaises(ValueError):
                parse_firewall_config(raw)

    def test_rejects_ranges_that_are_invalid_or_allow_the_azure_wide_sentinel(self):
        for start, end in (
            ("0.0.0.0", "0.0.0.0"),
            ("0.0.0.0", "192.0.2.1"),
            ("192.0.2.2", "192.0.2.1"),
            ("192.0.2.0/24", "192.0.2.1"),
            ("2001:db8::1", "2001:db8::1"),
        ):
            with self.subTest(start=start, end=end), self.assertRaises(ValueError):
                rule = {**self.egress, "startIpAddress": start, "endIpAddress": end}
                parse_firewall_config(json.dumps({"mode": "restricted", "rules": [rule]}))

    def test_rejects_duplicate_rule_names(self):
        config = {"mode": "overlap", "rules": [self.egress, self.egress]}
        with self.assertRaisesRegex(ValueError, "duplicate name"):
            parse_firewall_config(json.dumps(config))
