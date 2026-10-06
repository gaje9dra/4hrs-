# Phase 16.21 — Dependency and Supply-Chain Certification

## 1. Phase objective

This certification reviews the actual 4HRS+ dependency graph, package manager configuration, lockfile, installation path, lifecycle scripts, CI supply chain, Netlify build configuration, framework/runtime compatibility, Prisma dependencies, client/server boundaries, vulnerability exposure, licensing, maintenance risk, and dependency failure/recovery controls.

No dependency was upgraded merely because a newer release exists. No Qikink catalog SDK or provider architecture change was introduced.

## 2. Dependency architecture

The application is a private Next.js App Router application using npm as its authoritative package manager, PostgreSQL/Prisma for persistence, Netlify for deployment, and Qikink only as a fulfillment provider.

Qikink remains downstream of the 4HRS+ catalog and provider mapping; this phase does not add Qikink catalog synchronization or browser-side provider access.

## 3. Direct dependency inventory

The authoritative direct dependency declarations are in `package.json`; the committed `package-lock.json` is the resolved installation graph.

| Package | Declared scope | Declared version/range | Role |
|---|---|---|---|
| @tailwindcss/postcss | production | ^4.1.14 | Tailwind/PostCSS integration |
| lucide-react | production | ^0.468.0 | UI icons |
| next | production | 16.3.8 | Application framework/runtime |
| react | production | ^19.3.0 | UI runtime |
| react-dom | production | ^19.3.0 | React DOM runtime |
| tailwindcss | production | ^4.1.14 | Styling |
| @prisma/client | production | ^6.19.0 | Database client |
| @netlify/functions | production | ^6.0.2 | Netlify function integration |
| @types/node | development | ^22.0.0 | Node typings |
| @types/react | development | ^19.0.0 | React typings |
| @types/react-dom | development | ^19.0.0 | React DOM typings |
| eslint | development | ^9.0.0 | Linting |
| eslint-config-next | development | 16.3.8 | Next.js lint integration |
| prisma | development | ^6.19.0 | Schema/client generation and migrations |
| tsx | development | ^4.20.5 | TypeScript script execution |
| typescript | development | ^5.9.0 | Type checking |
| deepmerge-ts | override | ^8.0.2 | Transitive dependency override |

The certification script resolves the committed lockfile at CI time and records the exact resolved versions, production flag, lockfile license metadata, duplicate-version count, lifecycle activity, and vulnerability metadata.

## 4. Transitive dependency analysis

The lockfile contains the complete npm v3 dependency graph. The certification script enumerates every locked package, detects duplicate package names with multiple resolved versions, identifies non-standard sources, checks integrity metadata, and records lifecycle activity.

Duplicate transitive versions are not automatically treated as defects because npm dependency trees may legitimately contain incompatible peer/range requirements.

## 5. Lockfile analysis

Evidence:
- `package-lock.json` exists and is committed.
- lockfile format is v3.
- `package.json` declares `npm@11.6.0`.
- package engines constrain Node to >=24.21.0 <25 and npm to >=11.6.0 <12.
- CI uses `npm ci`, not `npm install`.
- `.npmrc` enables strict engines and audit.
- certification checks root package/lockfile declaration consistency and integrity metadata.

Any `npm ci` rejection is treated as a certification failure; it is not bypassed by replacing `npm ci` with `npm install`.

## 6. Registry analysis

The repository `.npmrc` contains no custom registry override. The certification gate verifies the effective npm registry and rejects unexpected registries.

The expected registry is `https://registry.npmjs.org/`.

No registry credential is committed.

## 7. Dependency-confusion analysis

No internal/private package namespace is declared in the direct dependency list. No Git, local-path, or floating branch dependency is intentionally declared by `package.json`.

The certification script checks the lockfile for Git, HTTP, non-standard registry, and linked dependency sources and records any finding.

## 8. Install-script review

The root package has a `postinstall` script that runs `prisma generate`. This is required generated-client behavior and is also explicitly run by the build/typecheck workflows.

The lockfile is inspected for package lifecycle/install activity. Lifecycle activity is evidence, not automatically a vulnerability; suspicious scripts must be reviewed against their package purpose before being classified as a blocker.

## 9. NPM script review

The package scripts include build, lint, typecheck, tests, Prisma migration/generation, recovery/certification tooling, and administrative provisioning.

Potentially privileged/destructive commands are explicitly surfaced by the certification script for review. The normal production build path does not invoke the admin provisioning command or database reset command.

## 10. Package-manager review

npm is authoritative:
- `package-lock.json` is committed.
- `packageManager` is `npm@11.6.0`.
- CI invokes `npm ci`.
- Netlify is configured for Node 24.21.0 and npm 11.6.0.
- `.nvmrc` is 24.21.0.
- no alternate lockfile is intentionally supported.

## 11. Node/npm compatibility

Repository evidence:
- Node: >=24.21.0 <25
- npm: >=11.6.0 <12
- CI Node: 24.21.0
- Netlify Node: 24.21.0
- Netlify npm: 11.6.0
- `.nvmrc`: 24.21.0

The phase does not claim compatibility solely from a package declaration; the full CI build/typecheck/test gates provide the executable compatibility evidence.

## 12. Framework dependency certification

Current repository versions intentionally remain on the versions already present:
- Next.js 16.3.8
- React 19.3.0
- React DOM 19.3.0
- ESLint 9.x
- Tailwind CSS 4.1.x as declared
- Prisma 6.19.x as declared

The phase does not perform broad framework upgrades. The earlier phase target list names TypeScript 6.0.3 and @types/node 26.6.1, while the repository currently declares TypeScript ^5.9.0 and @types/node ^22.0.0. This is recorded as dependency-version drift from the target specification, not silently changed. The certification decision depends on actual compatibility/security evidence, not on an arbitrary upgrade.

## 13. Prisma certification

The application uses `prisma` and `@prisma/client` from the same 6.19.x release line. CI runs `npx prisma validate` and `npx prisma generate`, and the test/build paths exercise migrations and generated-client behavior.

No database architecture change is introduced by this phase.

## 14. Security vulnerability analysis

CI already runs production dependency scanning with:

`npm audit --omit=dev --audit-level=high`

The Phase 16.21 certification script repeats the production dependency audit in JSON form, records the vulnerability metadata, and fails certification on unresolved production CRITICAL/HIGH findings.

No blind `npm audit fix` is used.

## 15. Supply-chain attack surface

Relevant trust boundaries:
1. npm registry and package resolution
2. npm lifecycle scripts
3. GitHub Actions dependency installation
4. build-time execution
5. Netlify build/deployment
6. generated Prisma artifacts
7. runtime third-party APIs

A compromised package could potentially execute during installation/build and inherit CI/build secrets. Therefore the certification focuses on registry trust, lockfile integrity, lifecycle scripts, CI permissions, and server/client boundaries.

## 16. CI supply-chain analysis

CI uses:
- `actions/checkout@v4`
- `actions/setup-node@v4`
- `actions/upload-artifact@v4`

Workflow-level permissions are explicitly limited to `contents: read`. Test jobs receive test database configuration rather than production credentials.

The workflow does not expose production deployment credentials to the ordinary test/lint/typecheck jobs.

Action references are version-pinned to major versions rather than immutable SHAs. This is recorded as a supply-chain hardening opportunity, not fabricated as evidence of SHA pinning.

## 17. Netlify supply-chain analysis

`netlify.toml` declares:
- build command: `npm run build`
- Node 24.21.0
- npm 11.6.0
- esbuild for functions
- Next.js framework detection

No third-party Netlify plugin is declared in the repository configuration. Account-level Netlify integrations remain external evidence and are not claimed as verified from repository files.

## 18. Third-party SDK analysis

Repository-level integrations include Next.js/React, Prisma, Netlify Functions, Tailwind, icon rendering, and Qikink adapter code.

There is no browser-side Qikink catalog SDK. Qikink credentials are not intentionally exposed to browser code.

Payment configuration remains provider-neutral as established by earlier certification work; this phase does not add a payment SDK.

## 19. Client dependency analysis

Client-facing code is reviewed for imports of server-only dependencies and privileged provider code. The dependency architecture keeps Prisma, provider credentials, filesystem/Node facilities, and administrative operations server-side.

No dependency is intentionally added to client bundles by this phase.

## 20. Server dependency analysis

Server-side dependencies include Prisma, Next.js server/runtime facilities, Netlify function support, and provider adapters. Database and fulfillment credentials remain server-only.

## 21. Duplicate/dead dependency analysis

The certification script detects duplicate resolved package names. Duplicate versions are documented because they can arise from legitimate transitive constraints.

Dead dependencies are not removed solely from static import absence; configuration, scripts, generated code, and framework conventions must be considered first.

## 22. License analysis

License metadata is taken from the committed lockfile where present. The certification output records licenses for direct dependencies and does not make legal conclusions.

Unknown or unusual license metadata is flagged for human/legal review rather than silently treated as compliant.

## 23. Maintenance analysis

The phase records current repository versions and dependency health evidence available through npm audit and lockfile metadata. No dependency is upgraded solely for age.

Deprecated/abandoned critical packages are treated as findings only when repository or package metadata provides evidence.

## 24. Native module analysis

The lockfile is inspected for optional/native package entries and lifecycle activity. CI performs a clean installation and production build on Ubuntu with Node 24.21.0, providing executable compatibility evidence for the deployment toolchain.

## 25. Build toolchain analysis

The build chain is:
- Node 24.21.0
- npm 11.6.0
- Next.js 16.3.8
- React 19.3.0
- TypeScript ^5.9.0
- ESLint 9.x
- Tailwind/PostCSS 4.1.x
- Prisma 6.19.x

CI runs lint, typecheck, tests, Prisma validation/generation, and production build.

## 26. Test dependency analysis

Tests run through Node's test runner with `tsx`. CI uses an isolated PostgreSQL service and test DATABASE_URL/DIRECT_URL values.

No production database credentials are configured in the test job.

## 27. Version/override/patch analysis

The repository has one npm override:
`deepmerge-ts: ^8.0.2`.

It is reviewed as an intentional dependency-tree override and is not rewritten during certification.

No patch-package or local fork dependency was identified from repository configuration.

## 28. Git/tarball/local dependency analysis

Direct dependencies are registry/version based. The certification script rejects Git, local-link, HTTP, and unexpected registry sources in the resolved lockfile unless explicitly evidenced and reviewed.

## 29. Provenance analysis

The lockfile uses npm registry URLs and integrity hashes for registry packages. The certification gate checks for missing integrity metadata.

This phase does not claim stronger package provenance than the npm lockfile and registry evidence support.

## 30. Dependency update process

Dependency changes are expected to occur through reviewed Git changes with lockfile updates and CI validation. The repository already has a committed lockfile and CI gates.

No automated dependency-update system is introduced solely for this certification.

## 31. Rollback analysis

Dependency rollback is performed by reverting the reviewed `package.json`/lockfile commit and redeploying a known-good application commit. Database compatibility must be checked when reverting dependencies across migration boundaries.

No destructive dependency rollback automation is introduced.

## 32. Failure-mode analysis

| Failure | Detection | Impact | Recovery |
|---|---|---|---|
| npm registry outage | `npm ci` failure | Build/release blocked | Retry from trusted registry/cache |
| lockfile mismatch | `npm ci` failure | Release blocked | Repair package/lock consistency |
| vulnerable package | npm audit | Security exposure | Review/remediate before release |
| malicious install script | lifecycle review | Build/secret compromise | Block/review package |
| native build failure | CI install/build | Release blocked | Diagnose compatible package/runtime |
| registry auth failure | install failure | Release blocked | Restore intended registry credentials |
| compromised package | security monitoring/audit | Potential build/runtime compromise | Stop release, identify affected artifact, rotate secrets |

## 33. Supply-chain incident response

The repository provides CI failure gates and release validation, but operational incident ownership, secret rotation procedures, registry account recovery, and Netlify account controls are external operational evidence.

No such systems are invented by this phase.

## 34. Dependency security matrix

The machine-generated certification output records:
Package → Version → Direct/Transitive → Production → Client/Server classification → Purpose → Security Risk → License → Maintenance → Status.

The source of truth is the committed `package.json` + `package-lock.json`; the certification script generates the resolved values during CI.

## 35. Supply-chain test matrix

The certification gate covers:
- clean npm installation through CI `npm ci`
- package/lock mismatch detection
- dependency-install failure as a release blocker
- production npm audit
- lifecycle/install-script review
- registry configuration
- dependency-confusion source review
- CI permission review
- build secret boundary review
- client/server dependency review
- native module compatibility through CI
- Prisma validation/generation
- Next.js build
- Netlify configuration review
- dependency rollback procedure review

## 36. Remediations performed

1. Added a dedicated Phase 16.21 dependency/supply-chain certification script.
2. Added a CI certification gate for Phase 16.21.
3. Added deterministic checks for lockfile/package consistency.
4. Added registry/source/integrity checks.
5. Added lifecycle-script and privileged npm-script review.
6. Added duplicate dependency detection.
7. Added production npm-audit classification.
8. Added Node/npm/package-manager evidence collection.
9. Preserved the existing dependency versions and architecture; no blind upgrades were made.

## 37. Remaining risks

- The nominal phase stack lists TypeScript 6.0.3 and @types/node 26.6.1, while the repository currently declares older major/minor lines. This is documented rather than changed without evidence.
- GitHub Actions are referenced by trusted major-version tags rather than immutable commit SHAs.
- Account-level Netlify integration and deployment controls cannot be proven solely from repository files.
- License/legal review is limited to package metadata available in the lockfile.
- npm package provenance beyond lockfile integrity is not claimed.

## 38. CI results

The authoritative CI run for this phase must pass:
- `npm ci`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npx prisma validate`
- `npx prisma generate`
- production `npm audit`
- Phase 16.21 certification gate
- existing Phase 16.1–16.20 certification gates

The final CI run number and commit SHA are recorded here after GitHub Actions completes.

## 39. Final certification decision

**PENDING CI VALIDATION**

This line is intentionally temporary on the certification branch. It must be replaced with exactly one of the phase-defined final decisions after the complete CI gate has executed.

