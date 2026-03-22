import threading
from pipeline.domain_limiter import DomainLimiter, extract_domain


def test_acquire_release_basic():
    limiter = DomainLimiter(max_per_domain=2)
    limiter.acquire("example.com")
    limiter.acquire("example.com")
    limiter.release("example.com")
    limiter.release("example.com")


def test_different_domains_independent():
    limiter = DomainLimiter(max_per_domain=1)
    limiter.acquire("a.com")
    limiter.acquire("b.com")
    limiter.release("a.com")
    limiter.release("b.com")


def test_extract_domain_strips_www():
    assert extract_domain("https://www.example.com/events") == "example.com"


def test_extract_domain_preserves_subdomain():
    assert extract_domain("https://api.ticketmaster.com/v2/events") == "api.ticketmaster.com"


def test_extract_domain_handles_bare_domain():
    assert extract_domain("https://example.com") == "example.com"


def test_context_manager():
    limiter = DomainLimiter(max_per_domain=1)
    with limiter.limit("example.com"):
        pass  # Should acquire and release cleanly


def test_blocks_when_at_capacity():
    """A third acquire on a max=2 semaphore must block until one is released."""
    limiter = DomainLimiter(max_per_domain=2)
    limiter.acquire("example.com")
    limiter.acquire("example.com")

    acquired = threading.Event()

    def try_acquire():
        limiter.acquire("example.com")
        acquired.set()

    t = threading.Thread(target=try_acquire, daemon=True)
    t.start()

    # The third acquire should not succeed yet
    assert not acquired.wait(timeout=0.1), "Third acquire should block"

    limiter.release("example.com")
    assert acquired.wait(timeout=1.0), "Third acquire should unblock after release"
    limiter.release("example.com")
    limiter.release("example.com")
    t.join(timeout=1.0)


def test_context_manager_releases_on_exception():
    """limit() must release even when the body raises."""
    limiter = DomainLimiter(max_per_domain=1)
    try:
        with limiter.limit("example.com"):
            raise ValueError("intentional")
    except ValueError:
        pass

    # If the semaphore was released, we can acquire again without blocking
    acquired = threading.Event()

    def try_acquire():
        limiter.acquire("example.com")
        acquired.set()

    t = threading.Thread(target=try_acquire, daemon=True)
    t.start()
    assert acquired.wait(timeout=1.0), "Should be acquirable after exception in context manager"
    limiter.release("example.com")
    t.join(timeout=1.0)
