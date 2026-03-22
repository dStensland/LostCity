import threading
from contextlib import contextmanager
from urllib.parse import urlparse


class DomainLimiter:
    """Prevents multiple concurrent workers from exceeding max_per_domain
    simultaneous requests to the same hostname.

    Thread-safe: semaphores are created lazily under a lock so multiple
    threads initialising the same domain at the same time cannot race.
    """

    def __init__(self, max_per_domain: int = 2) -> None:
        self._max = max_per_domain
        self._semaphores: dict[str, threading.Semaphore] = {}
        self._lock = threading.Lock()

    def _get_semaphore(self, domain: str) -> threading.Semaphore:
        with self._lock:
            if domain not in self._semaphores:
                self._semaphores[domain] = threading.Semaphore(self._max)
            return self._semaphores[domain]

    def acquire(self, domain: str) -> None:
        self._get_semaphore(domain).acquire()

    def release(self, domain: str) -> None:
        self._get_semaphore(domain).release()

    @contextmanager
    def limit(self, domain: str):
        self.acquire(domain)
        try:
            yield
        finally:
            self.release(domain)


def extract_domain(url: str) -> str:
    """Return the effective hostname for rate-limiting purposes.

    Strips the ``www.`` prefix so that ``www.example.com`` and
    ``example.com`` share the same semaphore.  Other subdomains
    (e.g. ``api.ticketmaster.com``) are preserved because they may be
    served by different infrastructure with independent rate limits.
    """
    parsed = urlparse(url)
    host = parsed.hostname or ""
    if host.startswith("www."):
        host = host[4:]
    return host
