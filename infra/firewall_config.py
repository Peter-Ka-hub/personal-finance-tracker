import ipaddress
import json
import os
import re
import sys


def parse_firewall_config(raw):
    if not raw:
        raise ValueError("Set POSTGRES_FIREWALL_CONFIG explicitly")
    config = json.loads(raw)
    if not isinstance(config, dict) or set(config) != {"mode", "rules"}:
        raise ValueError("Expected an object with mode and rules")
    mode, rules = config["mode"], config["rules"]
    if mode not in ("overlap", "restricted") or not isinstance(rules, list):
        raise ValueError("Use mode overlap or restricted and an array of rules")
    if mode == "restricted" and not rules:
        raise ValueError("Restricted mode requires at least one explicit IPv4 rule")

    names = set()
    for index, rule in enumerate(rules, start=1):
        if not isinstance(rule, dict) or set(rule) != {"name", "startIpAddress", "endIpAddress"}:
            raise ValueError(f"Rule {index} must contain name, startIpAddress and endIpAddress")
        name = rule["name"]
        if not isinstance(name, str) or not re.fullmatch(r"[a-z0-9][a-z0-9_-]{0,119}", name):
            raise ValueError(f"Rule {index} has an invalid name")
        if name in names:
            raise ValueError(f"Rule {index} has a duplicate name")
        names.add(name)

        start, end = rule["startIpAddress"], rule["endIpAddress"]
        if not isinstance(start, str) or not isinstance(end, str):
            raise ValueError(f"Rule {index} requires IPv4 strings")
        try:
            start_ip = ipaddress.IPv4Address(start)
            end_ip = ipaddress.IPv4Address(end)
        except ipaddress.AddressValueError as error:
            raise ValueError(f"Rule {index} requires two IPv4 addresses") from error
        if start_ip.is_unspecified or start_ip > end_ip:
            raise ValueError(f"Rule {index} must be an ordered range excluding 0.0.0.0")

    return config


if __name__ == "__main__":
    try:
        print(json.dumps(parse_firewall_config(os.environ.get("POSTGRES_FIREWALL_CONFIG"))))
    except ValueError as error:
        sys.exit(f"Invalid PostgreSQL firewall configuration: {error}")
