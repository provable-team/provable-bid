"""Check generated PayPal enum constants without requiring installed SDK dependencies."""
import ast
from enum import Enum
from pathlib import Path
import unittest


class PayPalEnvironmentEnums(unittest.TestCase):
    def test_environments_are_named_in_each_sdk_enum(self):
        root = Path(__file__).parents[1] / "provable_bid_api" / "models" / "enums"
        for filename, name in (("mode.py", "Mode"), ("payout_mode.py", "PayoutMode"), ("payouts.py", "Payouts")):
            with self.subTest(enum=name):
                tree = ast.parse((root / filename).read_text())
                cls = next(node for node in tree.body if isinstance(node, ast.ClassDef) and node.name == name)
                module = ast.fix_missing_locations(ast.Module(body=[cls], type_ignores=[]))
                scope = {"Enum": Enum}
                exec(compile(module, str(root / filename), "exec"), scope)
                self.assertEqual(scope[name].PAYPAL_LIVE.value, "paypal_live")
                self.assertEqual(scope[name].PAYPAL_SANDBOX.value, "paypal_sandbox")


if __name__ == "__main__":
    unittest.main()
