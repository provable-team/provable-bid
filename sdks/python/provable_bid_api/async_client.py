from __future__ import annotations

from functools import cached_property
from types import TracebackType

from typing_extensions import Self

from .apis.agents import AsyncAgents
from .apis.assets import AsyncAssets
from .apis.competitions import AsyncCompetitions
from .apis.identity import AsyncIdentity
from .apis.payments import AsyncPayments
from .apis.settlement_api import AsyncSettlementApi
from .apis.studio import AsyncStudio
from .apis.submissions import AsyncSubmissions
from .apis.system import AsyncSystem
from .apis.webhooks import AsyncWebhooks
from .auth import AsyncAuthSchemes
from .base_client import DEFAULT_TIMEOUT, BaseProvableBidApiClient
from .core import (
    OPERATING_SYSTEM,
    PYTHON_RUNTIME,
    AsyncHttpClient,
    AsyncHttpx2Client,
    AsyncRawClient,
    BearerAuthScheme,
    LoggingOptionsOrDict,
    RetryOptionsOrDict,
    no_auth,
    param,
)
from .server.environment import Environment


class AsyncProvableBidApiClient(BaseProvableBidApiClient[AsyncRawClient]):
    def __init__(
        self,
        *,
        environment: Environment = "production",
        base_url: str | None = None,
        timeout: float = DEFAULT_TIMEOUT,
        retry_options: int | RetryOptionsOrDict | None = None,
        logging_options: LoggingOptionsOrDict | None = None,
        custom_async_http_client: AsyncHttpClient | None = None,
        bearer_auth: str | None = None,
    ) -> None:
        super().__init__(
            environment=environment,
            base_url=base_url,
            timeout=timeout,
            retry_options=retry_options,
            logging_options=logging_options,
        )
        self._raw_client = AsyncRawClient(
            http_client=(
                custom_async_http_client if custom_async_http_client is not None else AsyncHttpx2Client(timeout=timeout)
            ),
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
        self._auth = AsyncAuthSchemes(bearer_auth=BearerAuthScheme(bearer_auth) if bearer_auth is not None else no_auth)

    @cached_property
    def agents(self) -> AsyncAgents:
        return AsyncAgents(self._raw_client, self._server, self._auth)

    @cached_property
    def assets(self) -> AsyncAssets:
        return AsyncAssets(self._raw_client, self._server, self._auth)

    @cached_property
    def competitions(self) -> AsyncCompetitions:
        return AsyncCompetitions(self._raw_client, self._server, self._auth)

    @cached_property
    def identity(self) -> AsyncIdentity:
        return AsyncIdentity(self._raw_client, self._server, self._auth)

    @cached_property
    def payments(self) -> AsyncPayments:
        return AsyncPayments(self._raw_client, self._server, self._auth)

    @cached_property
    def settlement_api(self) -> AsyncSettlementApi:
        return AsyncSettlementApi(self._raw_client, self._server, self._auth)

    @cached_property
    def studio(self) -> AsyncStudio:
        return AsyncStudio(self._raw_client, self._server, self._auth)

    @cached_property
    def submissions(self) -> AsyncSubmissions:
        return AsyncSubmissions(self._raw_client, self._server, self._auth)

    @cached_property
    def system(self) -> AsyncSystem:
        return AsyncSystem(self._raw_client, self._server)

    @cached_property
    def webhooks(self) -> AsyncWebhooks:
        return AsyncWebhooks(self._raw_client, self._server)

    async def aclose(self) -> None:
        await self._raw_client.http_client.aclose()

    async def __aenter__(self) -> Self:
        return self

    async def __aexit__(
        self, exc_type: type[BaseException] | None, exc: BaseException | None, exc_tb: TracebackType | None
    ) -> None:
        await self.aclose()


AsyncClient = AsyncProvableBidApiClient
