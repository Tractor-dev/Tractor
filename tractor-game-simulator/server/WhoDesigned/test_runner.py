#!/usr/bin/env python3
"""
Test runner for validating the output against test_inputs.json
"""
import json
import subprocess
import sys

def run_test(test_case, test_num):
    """Run a single test case"""
    input_data = test_case["input"]
    expected_output = test_case["output"]["response"]

    # Write input to temporary file
    with open("input/log_forAI.json", "w") as f:
        json.dump(input_data, f)

    # Run the main program
    try:
        result = subprocess.run(
            [sys.executable, "__main__.py"],
            capture_output=True,
            text=True,
            timeout=10
        )

        if result.returncode != 0:
            print(f"Test {test_num} FAILED: Program exited with code {result.returncode}")
            print(f"STDERR: {result.stderr}")
            return False

        # Parse output
        try:
            actual_output = json.loads(result.stdout)["response"]
        except json.JSONDecodeError as e:
            print(f"Test {test_num} FAILED: Invalid JSON output")
            print(f"Output: {result.stdout}")
            print(f"Error: {e}")
            return False

        # Compare outputs
        if actual_output == expected_output:
            print(f"Test {test_num} PASSED")
            return True
        else:
            print(f"Test {test_num} FAILED:")
            print(f"  Expected: {expected_output}")
            print(f"  Got:      {actual_output}")
            return False

    except subprocess.TimeoutExpired:
        print(f"Test {test_num} FAILED: Timeout")
        return False
    except Exception as e:
        print(f"Test {test_num} FAILED: {e}")
        return False

def main():
    # Load test cases
    with open("test_inputs.json", "r") as f:
        test_cases = json.load(f)

    print(f"Running {len(test_cases)} test cases...")
    print("=" * 60)

    passed = 0
    failed = 0

    for i, test_case in enumerate(test_cases, 1):
        if run_test(test_case, i):
            passed += 1
        else:
            failed += 1
        print()

    print("=" * 60)
    print(f"Results: {passed} passed, {failed} failed out of {len(test_cases)} tests")

    if failed == 0:
        print("All tests passed!")
        return 0
    else:
        print(f"{failed} test(s) failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())
