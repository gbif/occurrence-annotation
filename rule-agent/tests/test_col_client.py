from rule_agent import col_client


def test_resolve_taxon_unwraps_col_search_usage(monkeypatch) -> None:
    monkeypatch.setattr(
        col_client,
        "get_json",
        lambda *_args, **_kwargs: {
            "result": [
                {
                    "usage": {
                        "id": "QWERTY",
                        "status": "accepted",
                        "name": {
                            "scientificName": "Calopteryx splendens",
                            "rank": "species",
                        },
                    },
                }
            ]
        },
    )

    result = col_client.resolve_taxon("Calopteryx splendens")

    assert result.id == "QWERTY"
    assert result.name == "Calopteryx splendens"


def test_resolve_taxon_searches_one_word_taxonomic_names_before_key_lookup(monkeypatch) -> None:
    monkeypatch.setattr(
        col_client,
        "get_json",
        lambda *_args, **_kwargs: {
            "result": [
                {
                    "usage": {
                        "id": "FAMILY",
                        "status": "accepted",
                        "name": {"scientificName": "Lophocoronidae", "rank": "family"},
                    }
                }
            ]
        },
    )

    result = col_client.resolve_taxon("Lophocoronidae")

    assert result.id == "FAMILY"
    assert result.name == "Lophocoronidae"