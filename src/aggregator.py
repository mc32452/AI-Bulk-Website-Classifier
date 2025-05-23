from typing import List, Dict


def aggregate(results: List[Dict], item: Dict) -> None:
    """
    Appends a classification result to the results list.
    """
    results.append(item)
