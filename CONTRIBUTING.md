# Contributing to Gateway

Thank you for contributing!

## Guidelines

We use AI tools to speed up development and code review. Because of that, you may see many comments from tools such as Greptile, CodeRabbit, or similar reviewers.

You do not need to fix every AI-generated comment. Sometimes these tools miss the project context or are not aligned with the project vision. Please use your judgment, but try to review at least the comments marked as high priority - P1, critical, major etc.

See the [technical philosophy](docs/about/technical-philosophy.mdx) for the
project's implementation principles.

## Commit Messages

Please use Conventional Commits for commit subjects and PR titles:

`type(scope): short summary`

Allowed types are `feat`, `fix`, `perf`, `docs`, `refactor`, `test`, `build`, `ci`, `chore`, and `revert`.

## Dashboard frontend

The admin dashboard is a Svelte 5 single-page app in `web/dashboard/`. The
built assets are committed under `internal/admin/dashboard/static/dist/` and
embedded into the Go binary, so plain `go build` works without Node.

Dashboard translations are welcome; see the
[translation guide](web/dashboard/src/lib/i18n/README.md).

When you change dashboard sources:

```sh
make frontend        # npm ci + vite build (requires Node 22+)
make test-dashboard  # frontend unit tests
```

Commit the regenerated `static/dist` output together with your source change —
CI verifies the committed build matches the sources. For live-reload
development, run the gateway on :8080 and `npm run dev` in `web/dashboard/`
(the Vite dev server proxies `/admin` and `/v1` API calls to the gateway).

## Questions

For questions, ideas, or general discussion, please use GitHub Discussions:

https://github.com/DevKuAI/devku-gateway/discussions

## License

The project is currently licensed under the MIT License.

See the [license documentation](docs/about/license.mdx) for details.

By submitting a contribution, you confirm that you have the right to submit it.

You also grant the project maintainers permission to use, sublicense, and relicense your contribution as part of the project under the current or future project licenses.
