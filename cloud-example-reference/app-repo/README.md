# Capstone Application Repository

Replace the placeholder source with your team's capstone application.

Mandatory repository content should eventually include:

- application source code;
- tests;
- Dockerfile;
- database migrations;
- README with local build/run instructions;
- `.gitea/workflows/ci.yml`;
- architecture/evidence links where appropriate.

The provided CI workflow assumes a Maven/Quarkus-style project. If your approved technology differs, adapt only the build/test stage while preserving the common pipeline responsibilities: verify -> image -> scan -> publish -> update GitOps desired state.
