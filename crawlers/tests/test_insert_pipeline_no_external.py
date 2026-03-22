"""Verify INSERT_PIPELINE no longer contains external API steps."""
from db.events import INSERT_PIPELINE


def test_pipeline_has_no_external_enrichment_steps():
    """The insert pipeline should not contain _step_enrich_film or _step_enrich_music."""
    step_names = [s.__name__ for s in INSERT_PIPELINE]
    assert "_step_enrich_film" not in step_names, "Film enrichment should be in async queue"
    assert "_step_enrich_music" not in step_names, "Music enrichment should be in async queue"


def test_pipeline_has_enqueue_step():
    """The insert pipeline should have an enqueue step at the end."""
    step_names = [s.__name__ for s in INSERT_PIPELINE]
    assert "_step_enqueue_enrichment" in step_names, "Pipeline should enqueue async enrichment"
