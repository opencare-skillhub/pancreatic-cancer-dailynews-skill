# Pancreatic Cancer News Digest - Test Suite

import pytest
from scripts.fetch import (
    generate_item_id,
    load_history,
    save_history,
    generate_summary,
    extract_tags
)

def test_generate_item_id():
    id1 = generate_item_id("ct", "NCT12345678")
    id2 = generate_item_id("pmid", "41950246")
    assert id1 == "ct:NCT12345678"
    assert id2 == "pmid:41950246"

def test_extract_tags():
    item = {"title": "Phase 3 trial of KRAS G12D inhibitor with immunotherapy"}
    tags = extract_tags(item)
    assert "#Phase3" in tags
    assert "#KRAS" in tags

def test_generate_summary_trial():
    item = {
        "title": "A Phase 2 Study of Drug X in Pancreatic Cancer",
        "type": "clinical_trial",
        "phase": "PHASE2",
        "status": "RECRUITING"
    }
    summary = generate_summary(item)
    assert "Phase 2" in summary
    assert "临床试验" in summary

def test_history_roundtrip(tmp_path):
    # Override data dir for test
    test_history = ["item1", "item2", "item3"]
    save_history(test_history)
    loaded = load_history()
    assert loaded == test_history

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
