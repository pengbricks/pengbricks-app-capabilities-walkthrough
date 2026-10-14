// Ported from the environment-separation design handoff. Diagram geometry and copy match the export.
import { Link } from 'react-router';

export function EnvironmentSeparationPage() {
  return (
    <div className="walkthrough">
      <svg width="0" height="0" className="svg-defs" aria-hidden="true" focusable="false">
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="8"
            markerHeight="8"
            orient="auto-start-reverse"
          >
            <path className="d-arrowhead" d="M0 0L10 5L0 10z" />
          </marker>
          <marker
            id="arrow-muted"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="8"
            markerHeight="8"
            orient="auto-start-reverse"
          >
            <path className="d-arrowhead-muted" d="M0 0L10 5L0 10z" />
          </marker>
        </defs>
      </svg>
      <article className="page">
        <nav className="crumbs od-cluster" aria-label="Breadcrumb">
          <Link to="/">Overview</Link>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
          </svg>
          <span>CI/CD &amp; version control</span>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
          </svg>
          <span>Guide</span>
        </nav>

        <header className="guide-head">
          <p className="eyebrow">Explainer</p>
          <h1>Environment separation: workspaces, Unity Catalog, and metastores</h1>
          <p className="hero-sub">
            How to lay out dev, test, stage, and prod on Databricks so code moves forward through Git and CI/CD, data
            stays where it belongs, and production changes only through automation.
          </p>
          <nav className="toc od-cluster" aria-label="On this page">
            <a href="#short">The short version</a>
            <a href="#layout">Layout</a>
            <a href="#bindings">Catalog bindings</a>
            <a href="#promotion">Promotion flow</a>
            <a href="#code-not-data">Code, not data</a>
            <a href="#identity">Who changes what</a>
            <a href="#practices">Practices</a>
            <a href="#repo">How this repo applies it</a>
          </nav>
        </header>

        <section className="guide-section" id="short" aria-labelledby="h-short">
          <h2 id="h-short">The short version</h2>
          <ol className="short-list">
            <li>
              <h3>One metastore per region.</h3>
              <p>
                Unity Catalog allows one metastore per region per account. Every environment workspace in that region
                attaches to it, so separation happens in catalogs and bindings, not in multiple metastores.
              </p>
            </li>
            <li>
              <h3>One workspace per environment.</h3>
              <p>
                Use dev, test, stage, and prod workspaces. Teams that need fewer can merge dev and test, but prod always
                gets its own workspace.
              </p>
            </li>
            <li>
              <h3>One catalog per environment</h3>
              <p>
                (or per environment and domain), each bound only to its own workspace and backed by its own storage.
              </p>
            </li>
            <li>
              <h3>Promote code, not data.</h3>
              <p>
                The same Git commit deploys to every target through a bundle. Data is rebuilt in each environment from
                that environment&apos;s sources.
              </p>
            </li>
            <li>
              <h3>Only service principals change prod.</h3>
              <p>
                People deploy to dev from their IDE. CI/CD deploys to test, stage, and prod with a service principal,
                and prod waits for an approval.
              </p>
            </li>
          </ol>
        </section>

        <section className="guide-section" id="layout" aria-labelledby="h-layout">
          <h2 id="h-layout">Layout</h2>
          <p className="prose">
            One account, one region, one metastore. Four workspaces, four catalogs, four storage locations. Each column
            is one environment, and nothing crosses between columns.
          </p>
          <figure className="diagram">
            <div className="diagram-scroll" tabIndex={0} role="group" aria-label="Layout diagram, scrollable">
              <svg viewBox="0 0 1160 600" className="d-svg" role="img" aria-labelledby="d1-title d1-desc">
                <title id="d1-title">Environment layout on one Unity Catalog metastore</title>
                <desc id="d1-desc">
                  A Databricks account contains one region with one Unity Catalog metastore. Four workspaces, dev, test,
                  stage, and prod, each bind to exactly one catalog: dev_sales, test_sales, stage_sales, prod_sales.
                  Every catalog lives in the metastore and writes to its own cloud storage location: dev bucket, test
                  bucket, stage bucket, prod bucket.
                </desc>

                <rect className="d-frame" x="8" y="8" width="1144" height="436" rx="8" />
                <text className="t-label" x="28" y="36">
                  DATABRICKS ACCOUNT
                </text>
                <rect className="d-frame-inner" x="24" y="52" width="1112" height="376" rx="8" />
                <text className="t-label" x="44" y="80">
                  REGION
                </text>

                <text className="t-gutter" x="44" y="138">
                  Workspaces
                </text>
                <text className="t-gutter-sub" x="44" y="156">
                  one per environment
                </text>
                <g>
                  <rect className="d-box" x="184" y="112" width="192" height="60" rx="8" />
                  <text className="t t-c t-strong" x="280" y="147">
                    dev workspace
                  </text>
                  <rect className="d-box" x="424" y="112" width="192" height="60" rx="8" />
                  <text className="t t-c t-strong" x="520" y="147">
                    test workspace
                  </text>
                  <rect className="d-box" x="664" y="112" width="192" height="60" rx="8" />
                  <text className="t t-c t-strong" x="760" y="147">
                    stage workspace
                  </text>
                  <rect className="d-box d-prod" x="904" y="112" width="192" height="60" rx="8" />
                  <text className="t t-c t-strong" x="1000" y="147">
                    prod workspace
                  </text>
                </g>

                <g>
                  <line className="d-dash" x1="280" y1="172" x2="280" y2="268" />
                  <line className="d-dash" x1="520" y1="172" x2="520" y2="268" />
                  <line className="d-dash" x1="760" y1="172" x2="760" y2="268" />
                  <line className="d-dash" x1="1000" y1="172" x2="1000" y2="268" />
                  <text className="t-m" x="288" y="200">
                    binding
                  </text>
                  <text className="t-m" x="528" y="200">
                    binding
                  </text>
                  <text className="t-m" x="768" y="200">
                    binding
                  </text>
                  <text className="t-m" x="1008" y="200">
                    binding
                  </text>
                </g>

                <rect className="d-metastore" x="40" y="216" width="1080" height="196" rx="8" />
                <text className="t-gutter" x="60" y="296">
                  Metastore
                </text>
                <text className="t-gutter-sub" x="60" y="314">
                  one per region
                </text>
                <g>
                  <rect className="d-box" x="184" y="268" width="192" height="64" rx="8" />
                  <text className="t t-c t-mono" x="280" y="296">
                    dev_sales
                  </text>
                  <text className="t-m t-c" x="280" y="318">
                    isolated · bound to dev
                  </text>
                  <rect className="d-box" x="424" y="268" width="192" height="64" rx="8" />
                  <text className="t t-c t-mono" x="520" y="296">
                    test_sales
                  </text>
                  <text className="t-m t-c" x="520" y="318">
                    isolated · bound to test
                  </text>
                  <rect className="d-box" x="664" y="268" width="192" height="64" rx="8" />
                  <text className="t t-c t-mono" x="760" y="296">
                    stage_sales
                  </text>
                  <text className="t-m t-c" x="760" y="318">
                    isolated · bound to stage
                  </text>
                  <rect className="d-box d-prod" x="904" y="268" width="192" height="64" rx="8" />
                  <text className="t t-c t-mono" x="1000" y="296">
                    prod_sales
                  </text>
                  <text className="t-m t-c" x="1000" y="318">
                    isolated · bound to prod
                  </text>
                </g>
                <text className="t-m" x="184" y="392">
                  Catalogs, each bound to one workspace
                </text>

                <g>
                  <line className="d-line" x1="280" y1="332" x2="280" y2="488" markerEnd="url(#arrow)" />
                  <line className="d-line" x1="520" y1="332" x2="520" y2="488" markerEnd="url(#arrow)" />
                  <line className="d-line" x1="760" y1="332" x2="760" y2="488" markerEnd="url(#arrow)" />
                  <line className="d-line" x1="1000" y1="332" x2="1000" y2="488" markerEnd="url(#arrow)" />
                  <text className="t-m" x="288" y="472">
                    managed location
                  </text>
                  <text className="t-m" x="528" y="472">
                    managed location
                  </text>
                  <text className="t-m" x="768" y="472">
                    managed location
                  </text>
                  <text className="t-m" x="1008" y="472">
                    managed location
                  </text>
                </g>
                <text className="t-gutter" x="28" y="518">
                  Cloud storage
                </text>
                <text className="t-gutter-sub" x="28" y="536">
                  one location per env
                </text>
                <g>
                  <path className="d-box" d="M184 500h64l8 -8h112a8 8 0 0 1 8 8v48a8 8 0 0 1-8 8H192a8 8 0 0 1-8-8z" />
                  <text className="t t-c" x="280" y="532">
                    dev bucket
                  </text>
                  <path className="d-box" d="M424 500h64l8 -8h112a8 8 0 0 1 8 8v48a8 8 0 0 1-8 8H432a8 8 0 0 1-8-8z" />
                  <text className="t t-c" x="520" y="532">
                    test bucket
                  </text>
                  <path className="d-box" d="M664 500h64l8 -8h112a8 8 0 0 1 8 8v48a8 8 0 0 1-8 8H672a8 8 0 0 1-8-8z" />
                  <text className="t t-c" x="760" y="532">
                    stage bucket
                  </text>
                  <path
                    className="d-box d-prod"
                    d="M904 500h64l8 -8h112a8 8 0 0 1 8 8v48a8 8 0 0 1-8 8H912a8 8 0 0 1-8-8z"
                  />
                  <text className="t t-c" x="1000" y="532">
                    prod bucket
                  </text>
                </g>
              </svg>
            </div>
            <figcaption className="od-cluster">
              <span className="legend-item od-row">
                <svg viewBox="0 0 32 8" aria-hidden="true">
                  <line className="d-dash" x1="0" y1="4" x2="32" y2="4" />
                </svg>
                <span>Workspace-catalog binding</span>
              </span>
              <span className="legend-item od-row">
                <svg viewBox="0 0 32 8" aria-hidden="true">
                  <line className="d-line" x1="0" y1="4" x2="32" y2="4" />
                </svg>
                <span>Managed storage location</span>
              </span>
              <span className="legend-item od-row">
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <rect className="d-box d-prod" x="1" y="1" width="14" height="14" rx="3" />
                </svg>
                <span>Production, heavier outline</span>
              </span>
            </figcaption>
          </figure>
        </section>

        <section className="guide-section" id="bindings" aria-labelledby="h-bindings">
          <h2 id="h-bindings">What each workspace can see</h2>
          <p className="prose">
            Binding is what makes the separation hold. A catalog in isolated mode is invisible from any workspace it is
            not bound to, regardless of grants. The one exception is a deliberate read-only binding of prod into stage
            for a parity check.
          </p>
          <figure className="diagram">
            <div
              className="diagram-scroll"
              tabIndex={0}
              role="group"
              aria-label="Catalog visibility diagram, scrollable"
            >
              <svg viewBox="0 0 760 340" className="d-svg d-svg-md" role="img" aria-labelledby="d2-title d2-desc">
                <title id="d2-title">Catalog visibility by workspace</title>
                <desc id="d2-desc">
                  A grid of four workspaces by four catalogs. Each workspace can read and write only its own catalog.
                  All other combinations are not visible. Stage may optionally get a read-only binding to prod_sales for
                  parity checks.
                </desc>

                <text className="t-label" x="24" y="40">
                  WORKSPACE ↓ · CATALOG →
                </text>
                <text className="t t-c t-mono" x="265" y="40">
                  dev_sales
                </text>
                <text className="t t-c t-mono" x="403" y="40">
                  test_sales
                </text>
                <text className="t t-c t-mono" x="541" y="40">
                  stage_sales
                </text>
                <text className="t t-c t-mono" x="679" y="40">
                  prod_sales
                </text>

                <text className="t t-strong" x="24" y="91">
                  dev
                </text>
                <text className="t t-strong" x="24" y="151">
                  test
                </text>
                <text className="t t-strong" x="24" y="211">
                  stage
                </text>
                <text className="t t-strong" x="24" y="271">
                  prod
                </text>

                <rect className="d-cell-own" x="200" y="60" width="130" height="52" rx="6" />
                <text className="t-inv t-c" x="265" y="91">
                  read / write
                </text>
                <rect className="d-cell-none" x="338" y="60" width="130" height="52" rx="6" />
                <text className="t-m t-c" x="403" y="91">
                  not visible
                </text>
                <rect className="d-cell-none" x="476" y="60" width="130" height="52" rx="6" />
                <text className="t-m t-c" x="541" y="91">
                  not visible
                </text>
                <rect className="d-cell-none" x="614" y="60" width="130" height="52" rx="6" />
                <text className="t-m t-c" x="679" y="91">
                  not visible
                </text>

                <rect className="d-cell-none" x="200" y="120" width="130" height="52" rx="6" />
                <text className="t-m t-c" x="265" y="151">
                  not visible
                </text>
                <rect className="d-cell-own" x="338" y="120" width="130" height="52" rx="6" />
                <text className="t-inv t-c" x="403" y="151">
                  read / write
                </text>
                <rect className="d-cell-none" x="476" y="120" width="130" height="52" rx="6" />
                <text className="t-m t-c" x="541" y="151">
                  not visible
                </text>
                <rect className="d-cell-none" x="614" y="120" width="130" height="52" rx="6" />
                <text className="t-m t-c" x="679" y="151">
                  not visible
                </text>

                <rect className="d-cell-none" x="200" y="180" width="130" height="52" rx="6" />
                <text className="t-m t-c" x="265" y="211">
                  not visible
                </text>
                <rect className="d-cell-none" x="338" y="180" width="130" height="52" rx="6" />
                <text className="t-m t-c" x="403" y="211">
                  not visible
                </text>
                <rect className="d-cell-own" x="476" y="180" width="130" height="52" rx="6" />
                <text className="t-inv t-c" x="541" y="211">
                  read / write
                </text>
                <rect className="d-cell-optional" x="614" y="180" width="130" height="52" rx="6" />
                <text className="t t-c" x="679" y="204">
                  read-only
                </text>
                <text className="t-m t-c" x="679" y="222">
                  optional, parity
                </text>

                <rect className="d-cell-none" x="200" y="240" width="130" height="52" rx="6" />
                <text className="t-m t-c" x="265" y="271">
                  not visible
                </text>
                <rect className="d-cell-none" x="338" y="240" width="130" height="52" rx="6" />
                <text className="t-m t-c" x="403" y="271">
                  not visible
                </text>
                <rect className="d-cell-none" x="476" y="240" width="130" height="52" rx="6" />
                <text className="t-m t-c" x="541" y="271">
                  not visible
                </text>
                <rect className="d-cell-own d-prod-cell" x="614" y="240" width="130" height="52" rx="6" />
                <text className="t-inv t-c" x="679" y="271">
                  read / write
                </text>

                <text className="t-m" x="24" y="324">
                  Grants still apply inside a bound catalog. Binding decides whether the catalog appears at all.
                </text>
              </svg>
            </div>
            <figcaption className="od-cluster">
              <span className="legend-item od-row">
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <rect className="d-cell-own" x="1" y="1" width="14" height="14" rx="3" />
                </svg>
                <span>Bound, read / write</span>
              </span>
              <span className="legend-item od-row">
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <rect className="d-cell-optional" x="1" y="1" width="14" height="14" rx="3" />
                </svg>
                <span>Optional read-only binding</span>
              </span>
              <span className="legend-item od-row">
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <rect className="d-cell-none" x="1" y="1" width="14" height="14" rx="3" />
                </svg>
                <span>Not bound, not visible</span>
              </span>
            </figcaption>
          </figure>
        </section>

        <section className="guide-section" id="promotion" aria-labelledby="h-promotion">
          <h2 id="h-promotion">Promotion flow</h2>
          <p className="prose">
            People work in the top lane and touch only dev. Everything in the bottom lane runs as a service principal,
            and each step past dev waits for an approval.
          </p>
          <figure className="diagram">
            <div className="diagram-scroll" tabIndex={0} role="group" aria-label="Promotion flow diagram, scrollable">
              <svg viewBox="0 0 1160 360" className="d-svg" role="img" aria-labelledby="d3-title d3-desc">
                <title id="d3-title">Promotion flow from IDE to prod</title>
                <desc id="d3-desc">
                  A developer deploys to dev from the IDE with bundle deploy -t dev and opens a pull request. CI runs
                  unit tests and bundle validate. After merge to main, a service principal deploys to dev and runs a
                  smoke run. After an approval, the same commit deploys to test. After a second approval it deploys to
                  stage. After a release approval, the tagged release deploys to prod.
                </desc>

                <rect className="d-lane" x="8" y="16" width="1144" height="120" rx="8" />
                <text className="t-label" x="24" y="40">
                  PEOPLE
                </text>
                <rect className="d-lane" x="8" y="152" width="1144" height="192" rx="8" />
                <text className="t-label" x="24" y="176">
                  AUTOMATION · SERVICE PRINCIPAL
                </text>

                <rect className="d-box" x="24" y="56" width="152" height="60" rx="8" />
                <text className="t t-c t-strong" x="100" y="81">
                  Developer IDE
                </text>
                <text className="t-m t-c t-mono" x="100" y="101">
                  bundle deploy -t dev
                </text>

                <rect className="d-box" x="200" y="56" width="100" height="60" rx="8" />
                <text className="t t-c t-strong" x="250" y="91">
                  Pull request
                </text>

                <rect className="d-box" x="324" y="56" width="100" height="60" rx="8" />
                <text className="t t-c t-strong" x="374" y="81">
                  Merge
                </text>
                <text className="t-m t-c" x="374" y="101">
                  to main
                </text>

                <rect className="d-box" x="200" y="216" width="100" height="64" rx="8" />
                <text className="t t-c t-strong" x="250" y="242">
                  CI
                </text>
                <text className="t-m t-c" x="250" y="260">
                  unit tests
                </text>
                <text className="t-m t-c" x="250" y="274">
                  bundle validate
                </text>

                <rect className="d-box" x="324" y="216" width="100" height="64" rx="8" />
                <text className="t t-c t-strong" x="374" y="244">
                  Deploy dev
                </text>
                <text className="t-m t-c" x="374" y="264">
                  service principal
                </text>

                <rect className="d-box" x="448" y="216" width="100" height="64" rx="8" />
                <text className="t t-c t-strong" x="498" y="244">
                  Smoke run
                </text>
                <text className="t-m t-c" x="498" y="264">
                  on dev
                </text>

                <path className="d-gate" d="M594 226l22 22-22 22-22-22z" />
                <text className="t-m t-c" x="594" y="300">
                  Approval
                </text>

                <rect className="d-box" x="640" y="216" width="100" height="64" rx="8" />
                <text className="t t-c t-strong" x="690" y="244">
                  Deploy test
                </text>
                <text className="t-m t-c" x="690" y="264">
                  same commit
                </text>

                <path className="d-gate" d="M786 226l22 22-22 22-22-22z" />
                <text className="t-m t-c" x="786" y="300">
                  Approval
                </text>

                <rect className="d-box" x="832" y="216" width="100" height="64" rx="8" />
                <text className="t t-c t-strong" x="882" y="244">
                  Deploy stage
                </text>
                <text className="t-m t-c" x="882" y="264">
                  same commit
                </text>

                <path className="d-gate" d="M978 226l22 22-22 22-22-22z" />
                <text className="t-m t-c" x="978" y="300">
                  Release
                </text>
                <text className="t-m t-c" x="978" y="316">
                  approval
                </text>

                <rect className="d-box d-prod" x="1024" y="216" width="100" height="64" rx="8" />
                <text className="t t-c t-strong" x="1074" y="244">
                  Deploy prod
                </text>
                <text className="t-m t-c" x="1074" y="264">
                  tagged release
                </text>

                <line className="d-line" x1="176" y1="86" x2="198" y2="86" markerEnd="url(#arrow)" />
                <line className="d-line" x1="250" y1="116" x2="250" y2="214" markerEnd="url(#arrow)" />
                <path className="d-line" d="M300 248H312V86H322" markerEnd="url(#arrow)" />
                <line className="d-line" x1="374" y1="116" x2="374" y2="214" markerEnd="url(#arrow)" />
                <line className="d-line" x1="424" y1="248" x2="446" y2="248" markerEnd="url(#arrow)" />
                <line className="d-line" x1="548" y1="248" x2="570" y2="248" markerEnd="url(#arrow)" />
                <line className="d-line" x1="616" y1="248" x2="638" y2="248" markerEnd="url(#arrow)" />
                <line className="d-line" x1="740" y1="248" x2="762" y2="248" markerEnd="url(#arrow)" />
                <line className="d-line" x1="808" y1="248" x2="830" y2="248" markerEnd="url(#arrow)" />
                <line className="d-line" x1="932" y1="248" x2="954" y2="248" markerEnd="url(#arrow)" />
                <line className="d-line" x1="1000" y1="248" x2="1022" y2="248" markerEnd="url(#arrow)" />
              </svg>
            </div>
            <figcaption className="od-cluster">
              <span className="legend-item od-row">
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path className="d-gate" d="M8 1l7 7-7 7-7-7z" />
                </svg>
                <span>Approval gate (GitHub environment with required reviewers)</span>
              </span>
              <span className="legend-item od-row">
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <rect className="d-box d-prod" x="1" y="1" width="14" height="14" rx="3" />
                </svg>
                <span>Production</span>
              </span>
            </figcaption>
          </figure>
        </section>

        <section className="guide-section" id="code-not-data" aria-labelledby="h-code-data">
          <h2 id="h-code-data">Promote code, not data</h2>
          <p className="prose">
            One commit and one bundle reach every target. Only the target changes, and with it the workspace host and
            the catalog variable. Each environment then builds its own data from its own sources.
          </p>
          <figure className="diagram">
            <div className="diagram-scroll" tabIndex={0} role="group" aria-label="Code promotion diagram, scrollable">
              <svg viewBox="0 0 1040 352" className="d-svg" role="img" aria-labelledby="d4-title d4-desc">
                <title id="d4-title">One commit deploys to four targets; data is rebuilt per environment</title>
                <desc id="d4-desc">
                  A single Git commit becomes one bundle, databricks.yml. The bundle deploys to four targets, dev, test,
                  stage, and prod, each with its own catalog variable. In each environment, pipelines rebuild that
                  environment&apos;s catalog from that environment&apos;s own sources. No data is copied between environments.
                </desc>

                <rect className="d-box" x="16" y="144" width="168" height="64" rx="8" />
                <text className="t t-c t-strong" x="100" y="170">
                  Git commit
                </text>
                <text className="t-m t-c t-mono" x="100" y="190">
                  tag v1.4.2
                </text>

                <line className="d-line" x1="184" y1="176" x2="222" y2="176" markerEnd="url(#arrow)" />

                <rect className="d-box" x="224" y="144" width="168" height="64" rx="8" />
                <text className="t t-c t-strong" x="308" y="170">
                  One bundle
                </text>
                <text className="t-m t-c t-mono" x="308" y="190">
                  databricks.yml
                </text>

                <path className="d-line" d="M392 176H432V48H470" markerEnd="url(#arrow)" />
                <path className="d-line" d="M432 176V132H470" markerEnd="url(#arrow)" />
                <path className="d-line" d="M432 176V216H470" markerEnd="url(#arrow)" />
                <path className="d-line" d="M432 176V300H470" markerEnd="url(#arrow)" />

                <rect className="d-box" x="472" y="16" width="208" height="64" rx="8" />
                <text className="t t-c t-strong t-mono" x="576" y="42">
                  -t dev
                </text>
                <text className="t-m t-c t-mono" x="576" y="62">
                  catalog = dev_sales
                </text>
                <rect className="d-box" x="472" y="100" width="208" height="64" rx="8" />
                <text className="t t-c t-strong t-mono" x="576" y="126">
                  -t test
                </text>
                <text className="t-m t-c t-mono" x="576" y="146">
                  catalog = test_sales
                </text>
                <rect className="d-box" x="472" y="184" width="208" height="64" rx="8" />
                <text className="t t-c t-strong t-mono" x="576" y="210">
                  -t stage
                </text>
                <text className="t-m t-c t-mono" x="576" y="230">
                  catalog = stage_sales
                </text>
                <rect className="d-box d-prod" x="472" y="268" width="208" height="64" rx="8" />
                <text className="t t-c t-strong t-mono" x="576" y="294">
                  -t prod
                </text>
                <text className="t-m t-c t-mono" x="576" y="314">
                  catalog = prod_sales
                </text>

                <line className="d-line" x1="680" y1="48" x2="742" y2="48" markerEnd="url(#arrow)" />
                <line className="d-line" x1="680" y1="132" x2="742" y2="132" markerEnd="url(#arrow)" />
                <line className="d-line" x1="680" y1="216" x2="742" y2="216" markerEnd="url(#arrow)" />
                <line className="d-line" x1="680" y1="300" x2="742" y2="300" markerEnd="url(#arrow)" />
                <text className="t-m" x="690" y="40">
                  rebuild
                </text>
                <text className="t-m" x="690" y="124">
                  rebuild
                </text>
                <text className="t-m" x="690" y="208">
                  rebuild
                </text>
                <text className="t-m" x="690" y="292">
                  rebuild
                </text>

                <rect className="d-surface-box" x="744" y="16" width="280" height="64" rx="8" />
                <text className="t" x="760" y="42">
                  dev sources → <tspan className="t-mono">dev_sales</tspan>
                </text>
                <text className="t-m" x="760" y="62">
                  synthetic data (dbldatagen)
                </text>
                <rect className="d-surface-box" x="744" y="100" width="280" height="64" rx="8" />
                <text className="t" x="760" y="126">
                  test sources → <tspan className="t-mono">test_sales</tspan>
                </text>
                <text className="t-m" x="760" y="146">
                  synthetic or masked samples
                </text>
                <rect className="d-surface-box" x="744" y="184" width="280" height="64" rx="8" />
                <text className="t" x="760" y="210">
                  stage sources → <tspan className="t-mono">stage_sales</tspan>
                </text>
                <text className="t-m" x="760" y="230">
                  approved datasets via Delta Sharing
                </text>
                <rect className="d-surface-box d-prod" x="744" y="268" width="280" height="64" rx="8" />
                <text className="t" x="760" y="294">
                  prod sources → <tspan className="t-mono">prod_sales</tspan>
                </text>
                <text className="t-m" x="760" y="314">
                  production systems only
                </text>
              </svg>
            </div>
            <figcaption>
              Data never moves between the boxes on the right. When environments span regions or accounts, share across
              metastores with Delta Sharing instead of copying.
            </figcaption>
          </figure>
        </section>

        <section className="guide-section" id="identity" aria-labelledby="h-identity">
          <h2 id="h-identity">Who changes what</h2>
          <p className="prose">
            Grant to groups, not users. People deploy only to dev. Everywhere else the environment&apos;s service principal
            deploys, and in prod it also owns the objects and runs the jobs, so ownership doesn&apos;t leave when a person
            does.
          </p>
          <figure className="diagram">
            <div className="diagram-scroll" tabIndex={0} role="group" aria-label="Identity diagram, scrollable">
              <svg viewBox="0 0 1040 296" className="d-svg" role="img" aria-labelledby="d5-title d5-desc">
                <title id="d5-title">People and service principals by environment</title>
                <desc id="d5-desc">
                  In dev, people in the dev-engineers group deploy from the IDE, and the service principal deploys
                  merged main. In test and stage, people do not deploy; the service principal deploys after approval. In
                  prod, people get read access only; the prod service principal deploys after release approval, owns the
                  objects, and jobs and pipelines run_as it.
                </desc>

                <text className="t-label" x="24" y="40">
                  IDENTITY ↓ · ENVIRONMENT →
                </text>
                <text className="t t-c t-strong" x="313" y="40">
                  dev
                </text>
                <text className="t t-c t-strong" x="513" y="40">
                  test
                </text>
                <text className="t t-c t-strong" x="713" y="40">
                  stage
                </text>
                <text className="t t-c t-strong" x="913" y="40">
                  prod
                </text>

                <text className="t t-strong" x="24" y="88">
                  People
                </text>
                <text className="t-m t-mono" x="24" y="108">
                  &lt;env&gt;-engineers
                </text>
                <text className="t-m t-mono" x="24" y="124">
                  &lt;env&gt;-analysts
                </text>
                <rect className="d-cell-own" x="220" y="60" width="186" height="80" rx="6" />
                <text className="t-inv t-c" x="313" y="96">
                  Deploy from IDE
                </text>
                <text className="t-inv-m t-c t-mono" x="313" y="116">
                  bundle deploy -t dev
                </text>
                <rect className="d-cell-none" x="420" y="60" width="186" height="80" rx="6" />
                <text className="t-m t-c" x="513" y="104">
                  No deploy
                </text>
                <rect className="d-cell-none" x="620" y="60" width="186" height="80" rx="6" />
                <text className="t-m t-c" x="713" y="104">
                  No deploy
                </text>
                <rect className="d-cell-optional" x="820" y="60" width="186" height="80" rx="6" />
                <text className="t t-c" x="913" y="96">
                  Read access
                </text>
                <text className="t-m t-c" x="913" y="116">
                  no deploy, no ownership
                </text>

                <text className="t t-strong" x="24" y="184">
                  Service principal
                </text>
                <text className="t-m t-mono" x="24" y="204">
                  &lt;env&gt;-deployers
                </text>
                <text className="t-m" x="24" y="220">
                  via CI/CD
                </text>
                <rect className="d-cell-own" x="220" y="156" width="186" height="80" rx="6" />
                <text className="t-inv t-c" x="313" y="192">
                  Deploys merged main
                </text>
                <text className="t-inv-m t-c" x="313" y="212">
                  then smoke run
                </text>
                <rect className="d-cell-own" x="420" y="156" width="186" height="80" rx="6" />
                <text className="t-inv t-c" x="513" y="192">
                  Deploys after approval
                </text>
                <text className="t-inv-m t-c" x="513" y="212">
                  same commit
                </text>
                <rect className="d-cell-own" x="620" y="156" width="186" height="80" rx="6" />
                <text className="t-inv t-c" x="713" y="192">
                  Deploys after approval
                </text>
                <text className="t-inv-m t-c" x="713" y="212">
                  same commit
                </text>
                <rect className="d-cell-own d-prod-cell" x="820" y="156" width="186" height="80" rx="6" />
                <text className="t-inv t-c" x="913" y="184">
                  Release approval
                </text>
                <text className="t-inv-m t-c" x="913" y="204">
                  owns objects
                </text>
                <text className="t-inv-m t-c t-mono" x="913" y="222">
                  run_as
                </text>

                <text className="t-m" x="24" y="276">
                  The metastore admin role goes to a small admin group, not a person.
                </text>
              </svg>
            </div>
            <figcaption className="od-cluster">
              <span className="legend-item od-row">
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <rect className="d-cell-own" x="1" y="1" width="14" height="14" rx="3" />
                </svg>
                <span>Can change this environment</span>
              </span>
              <span className="legend-item od-row">
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <rect className="d-cell-optional" x="1" y="1" width="14" height="14" rx="3" />
                </svg>
                <span>Read only</span>
              </span>
              <span className="legend-item od-row">
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <rect className="d-cell-none" x="1" y="1" width="14" height="14" rx="3" />
                </svg>
                <span>No access to change</span>
              </span>
            </figcaption>
          </figure>
        </section>

        <section className="guide-section" id="practices" aria-labelledby="h-practices">
          <h2 id="h-practices">Practices</h2>

          <h3 className="table-title" id="t-workspace">
            Workspace practices
          </h3>
          <div className="table-wrap" tabIndex={0} role="region" aria-labelledby="t-workspace">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Practice</th>
                  <th scope="col">Why</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Separate prod workspace</td>
                  <td>Isolates prod identities, network rules, secrets, and quotas from development traffic.</td>
                </tr>
                <tr>
                  <td>Same region for all environment workspaces</td>
                  <td>They share one metastore, so lineage, grants, and system tables cover the whole path.</td>
                </tr>
                <tr>
                  <td>Workspace-catalog bindings</td>
                  <td>A prod catalog is not even visible from dev, regardless of grants.</td>
                </tr>
                <tr>
                  <td>Serverless compute with budget policies per environment</td>
                  <td>No cluster sprawl. Cost is attributed by environment tag.</td>
                </tr>
                <tr>
                  <td>Private networking and IP access lists on stage and prod</td>
                  <td>Prod is reachable only from approved networks.</td>
                </tr>
                <tr>
                  <td>Bundle targets map to workspaces</td>
                  <td>
                    <code>targets.prod.workspace.host</code> is the only place the prod host appears.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 className="table-title" id="t-uc">
            Unity Catalog practices
          </h3>
          <div className="table-wrap" tabIndex={0} role="region" aria-labelledby="t-uc">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Practice</th>
                  <th scope="col">How</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Catalog per environment</td>
                  <td>
                    <code>dev_&lt;domain&gt;</code>, <code>test_&lt;domain&gt;</code>, <code>stage_&lt;domain&gt;</code>
                    , <code>prod_&lt;domain&gt;</code>, or one catalog per environment with domain schemas. Pass the
                    catalog as a bundle variable. Never hard-code it.
                  </td>
                </tr>
                <tr>
                  <td>Managed storage per catalog</td>
                  <td>Set a managed location on each catalog pointing at that environment&apos;s bucket or container.</td>
                </tr>
                <tr>
                  <td>Bind catalogs to workspaces</td>
                  <td>
                    Set the catalog&apos;s isolation mode to isolated and bind it to the environment&apos;s workspace. Bind prod
                    read-only into stage only when a parity check needs it.
                  </td>
                </tr>
                <tr>
                  <td>Grant to groups, not users</td>
                  <td>
                    <code>&lt;env&gt;-engineers</code>, <code>&lt;env&gt;-analysts</code>,{' '}
                    <code>&lt;env&gt;-deployers</code>. In prod, people get read access and the deploy service principal
                    owns objects.
                  </td>
                </tr>
                <tr>
                  <td>Service principal ownership in prod</td>
                  <td>
                    Jobs and pipelines <code>run_as</code> the environment&apos;s service principal. Ownership does not leave
                    with a person.
                  </td>
                </tr>
                <tr>
                  <td>No prod data in dev</td>
                  <td>
                    Use synthetic data (this repo uses dbldatagen from a use-case spec), masked samples, or Delta
                    Sharing of approved datasets.
                  </td>
                </tr>
                <tr>
                  <td>Tags for environment and release</td>
                  <td>
                    Every resource carries <code>environment</code> and <code>release</code> tags, so system tables can
                    report by environment and commit.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 className="table-title">Metastore practices</h3>
          <ul className="practice-list">
            <li>
              <strong>One metastore per region, owned by a group.</strong> Assign the metastore admin role to a small
              admin group, not a person.
            </li>
            <li>
              <strong>No metastore-level default storage for business data.</strong> Give each catalog its own managed
              location, so the storage boundary follows the environment.
            </li>
            <li>
              <strong>Storage credentials and external locations per environment.</strong> The dev credential cannot
              reach the prod bucket.
            </li>
            <li>
              <strong>Use Delta Sharing between regions or accounts.</strong> When environments span regions, share
              across metastores instead of copying data.
            </li>
            <li>
              <strong>System tables are account-wide.</strong> Monitor every environment from one place and filter by{' '}
              <code>workspace_id</code> or the <code>environment</code> tag (see the monitoring guide).
            </li>
          </ul>
        </section>

        <section className="guide-section" id="repo" aria-labelledby="h-repo">
          <h2 id="h-repo">How this repo applies it</h2>
          <div className="table-wrap" tabIndex={0} role="region" aria-labelledby="h-repo">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col">Where</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <code>dev</code> and <code>test</code> targets with separate prefixes and schemas
                  </td>
                  <td>
                    <code>reference/ingestion/databricks.yml</code>
                  </td>
                </tr>
                <tr>
                  <td>Catalog, warehouse, and app identity are variables with no defaults</td>
                  <td>
                    every <code>reference/*/databricks.yml</code>
                  </td>
                </tr>
                <tr>
                  <td>CI deploys the same commit to dev, then test after approval</td>
                  <td>
                    <code>.github/workflows/reference-cicd.yml</code>
                  </td>
                </tr>
                <tr>
                  <td>
                    Resources tagged with <code>environment</code> and <code>release</code>
                  </td>
                  <td>
                    bundle <code>presets.tags</code>
                  </td>
                </tr>
                <tr>
                  <td>Synthetic data only</td>
                  <td>
                    <code>use_cases/*.yml</code> with dbldatagen
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="prose next-step">
            To add stage and prod, add targets with <code>mode: production</code>, a <code>workspace.host</code> per
            target, <code>run_as</code> set to that environment&apos;s service principal, and a GitHub environment for each
            with required reviewers.
          </p>
        </section>

        <nav className="pager od-grid" aria-label="Related guides">
          <Link className="prev" to="/guides/github-cicd">
            <span className="eyebrow">Related guide</span>
            <span className="pager-title">GitHub integration and CI/CD</span>
          </Link>
          <Link className="next" to="/guides/dataops">
            <span className="eyebrow">Related guide</span>
            <span className="pager-title">DataOps</span>
          </Link>
        </nav>
      </article>
    </div>
  );
}
