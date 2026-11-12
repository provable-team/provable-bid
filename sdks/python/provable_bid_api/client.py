from __future__ import annotations

from functools import cached_property
from types import TracebackType

from typing_extensions import Self

from .apis.agents import Agents
from .apis.assets import Assets
from .apis.competitions import Competitions
from .apis.identity import Identity
from .apis.payments import Payments
from .apis.settlement_api import SettlementApi
from .apis.studio import Studio
from .apis.submissions import Submissions
from .apis.system import System
from .apis.webhooks import Webhooks
from .auth import AuthSchemes
from .base_client import DEFAULT_TIMEOUT, BaseProvableBidApiClient
from .core import (
    OPERATING_SYSTEM,
    PYTHON_RUNTIME,
    BearerAuthScheme,
    HttpClient,
    Httpx2Client,
    LoggingOptionsOrDict,
    RawClient,
    RetryOptionsOrDict,
    no_auth,
    param,
)
from .server.environment import Environment


class ProvableBidApiClient(BaseProvableBidApiClient[RawClient]):
    def __init__(
        self,
        *,
        environment: Environment = "production",
        base_url: str | None = None,
        timeout: float = DEFAULT_TIMEOUT,
        retry_options: int | RetryOptionsOrDict | None = None,
        logging_options: LoggingOptionsOrDict | None = None,
        custom_http_client: HttpClient | None = None,
        bearer_auth: str | None = None,
    ) -> None:
        super().__init__(
            environment=environment,
            base_url=base_url,
            timeout=timeout,
            retry_options=retry_options,
            logging_options=logging_options,
        )
        self._raw_client = RawClient(
            http_client=custom_http_client if custom_http_client is not None else Httpx2Client(timeout=timeout),
            retry_options=self._retry_options,
            logging_options=self._logging_options,
            global_headers=[
                param[str]("User-Agent", "ProvableBidApiClient/0.4.0 Python"),
                param[str]("X-APIMatic-Lang", "Python"),
                param[str]("X-APIMatic-Package-Version", "0.4.0"),
                param[str]("X-APIMatic-Gen-Version", "4.0.0"),
                param[str]("X-APIMatic-OS", OPERATING_SYSTEM),
                param[str]("X-APIMatic-Runtime", PYTHON_RUNTIME),
            ],
        )
        self._auth = AuthSchemes(bearer_auth=BearerAuthScheme(bearer_auth) if bearer_auth is not None else no_auth)

    @cached_property
    def agents(self) -> Agents:
        return Agents(self._raw_client, self._server, self._auth)

    @cached_property
    def assets(self) -> Assets:
        return Assets(self._raw_client, self._server, self._auth)

    @cached_property
    def competitions(self) -> Competitions:
        return Competitions(self._raw_client, self._server, self._auth)

    @cached_property
    def identity(self) -> Identity:
        return Identity(self._raw_client, self._server, self._auth)

    @cached_property
    def payments(self) -> Payments:
        return Payments(self._raw_client, self._server, self._auth)

    @cached_property
    def settlement_api(self) -> SettlementApi:
        return SettlementApi(self._raw_client, self._server, self._auth)

    @cached_property
    def studio(self) -> Studio:
        return Studio(self._raw_client, self._server, self._auth)

    @cached_property
    def submissions(self) -> Submissions:
        return Submissions(self._raw_client, self._server, self._auth)

    @cached_property
    def system(self) -> System:
        return System(self._raw_client, self._server)

    @cached_property
    def webhooks(self) -> Webhooks:
        return Webhooks(self._raw_client, self._server)

    def close(self) -> None:
        self._raw_client.http_client.close()

    def __enter__(self) -> Self:
        return self

    def __exit__(
        self, exc_type: type[BaseException] | None, exc: BaseException | None, exc_tb: TracebackType | None
    ) -> None:
        self.close()


Client = ProvableBidApiClient
