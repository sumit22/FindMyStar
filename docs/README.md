# FindMyStar - Technical Documentation

**Precision Offline Celestial Object Finder with Smart Visibility Alerts**

This directory contains comprehensive technical documentation for the FindMyStar application - a fully offline mobile application for locating celestial objects using AR guidance and scheduling visibility alerts.

## 📚 Documentation Structure

### [01. Product Documentation](./01-product/)
Business and product-level documentation.
- **vision.md** - Product vision and market positioning
- **problem-statement.md** - Problem being solved
- **scope.md** - Feature scope and MVP definition
- **personas.md** - User personas and use cases
- **roadmap.md** - Product roadmap and phases

### [02. Requirements](./02-requirements/)
Formal Software Requirements Specification (SRS).
- **srs.md** - Complete SRS document
- **functional-requirements.md** - FR-1 through FR-16 detailed
- **non-functional-requirements.md** - Performance, reliability, accuracy requirements
- **constraints.md** - Technical and business constraints
- **glossary.md** - Terminology and definitions

### [03. Architecture](./03-architecture/)
Complete system architecture and design.
- **architecture-overview.md** - High-level architecture and design principles
- **design-principles.md** - Architectural decisions and guidelines
- **technology-stack.md** - Technology choices and rationale

#### [C4 Model](./03-architecture/c4-model/)
Macro-level system views.
- **context-diagram.md** - System context (Level 0)
- **container-diagram.puml** - Major containers (Level 1)
- **component-diagram.puml** - Component details (Level 2)

#### [UML Diagrams](./03-architecture/uml/)
Static structure and relationships.
- **class-diagram.puml** - Class definitions and relationships
- **package-diagram.puml** - Module organization
- **entity-relationship.puml** - Data model relationships

#### [Sequence Diagrams](./03-architecture/sequences/)
Dynamic behavior and runtime flows.
- **sequence-01-search-tracking.puml** - Object search to tracking initialization
- **sequence-02-tracking-loop.puml** - Real-time tracking runtime flow
- **sequence-03-visibility-check.puml** - Visibility evaluation
- **sequence-04-alarm-scheduling.puml** - Alarm scheduling flow
- **sequence-05-alarm-recalculation.puml** - Daily background recalculation
- **sequence-06-rise-set-solver.puml** - Rise/set calculation (planets)
- **sequence-07-circumpolar.puml** - Circumpolar/never-visible detection
- **sequence-08-error-handling.puml** - Error handling and recovery

### [04. Domain Engine](./04-domain-engine/)
Astronomical computation and algorithms.
- **overview.md** - Domain engine architecture
- **algorithms.md** - Core algorithms with mathematical formulations
- **ephemeris.md** - Celestial object position computation
- **coordinate-transforms.md** - Coordinate system transformations
- **rise-set-calculations.md** - Object visibility and rise/set times
- **vector-math.md** - 3D vector operations and quaternions
- **validation.md** - Validation against known ephemeris data
- **error-bounds.md** - Accuracy analysis and error propagation

### [05. Data Model](./05-data-model/)
Data persistence and queries.
- **schema.md** - SQLite database schema
- **catalog-design.md** - Celestial object catalog design
- **indexing-strategy.md** - Query optimization
- **migrations.md** - Schema migration strategy

### [06. Application Layer](./06-application-layer/)
Service orchestration and business logic.
- **overview.md** - Application layer architecture
- **services.md** - Service descriptions and interfaces
- **api-contracts.md** - Rust ↔ TypeScript FFI contracts
- **event-handling.md** - Event flow and messaging
- **error-handling.md** - Error handling strategy

### [07. UI/UX](./07-ui-ux/)
User interface design documentation.
- **overview.md** - UI architecture and state management
- **tracking-states.md** - Tracking mode states and transitions
- **alarm-feedback.md** - User feedback for alarms
- **accessibility.md** - Accessibility considerations

### [08. Testing](./08-testing/)
Quality assurance and validation.
- **overview.md** - Testing strategy
- **unit-tests.md** - Domain engine unit tests
- **integration-tests.md** - End-to-end integration tests
- **validation.md** - Astronomical validation test suite
- **performance.md** - Performance benchmarks

### [09. DevOps](./09-devops/)
Build and deployment infrastructure.
- **build-process.md** - Build pipeline and artifacts
- **ci-cd.md** - Continuous integration/deployment
- **code-standards.md** - Code style and standards
- **metrics.md** - Code quality metrics

### [10. Deployment](./10-deployment/)
Release and deployment procedures.
- **android-deployment.md** - Android app store deployment
- **ios-deployment.md** - iOS app store deployment
- **version-strategy.md** - Versioning strategy
- **release-checklist.md** - Release procedures

### [11. Architecture Decision Records (ADR)](./11-adr/)
Key architectural decisions with rationale.
- **README.md** - ADR index and template
- **0001-layered-architecture.md** - Rationale for layered design
- **0002-rust-core-engine.md** - Why Rust for astronomical core
- **0003-offline-first.md** - Offline-first with SQLite only

### Root-Level Documentation
Cross-cutting concerns and operational guides.
- **SECURITY.md** - Security threat model and privacy
- **PERFORMANCE_OPTIMIZATION.md** - Performance optimization guide
- **OPERATIONS.md** - Operational runbooks and troubleshooting
- **FAQ.md** - Frequently asked questions

## 🔄 Rendering Diagrams

### PlantUML Diagrams
All `.puml` files can be rendered using:
- [PlantUML Online Editor](http://www.plantuml.com/plantuml/uml/)
- VS Code extension: `PlantUML` (jebbs.plantuml)
- GitHub Markdown (with GitHub-PlantUML action)

### Mermaid Diagrams
Mermaid diagrams are supported natively in GitHub markdown.

## 📋 Quick Start

1. **Understanding the Product** → Start with [01-product/vision.md](./01-product/vision.md)
2. **Understanding Requirements** → Read [02-requirements/srs.md](./02-requirements/srs.md)
3. **Understanding Architecture** → Read [03-architecture/architecture-overview.md](./03-architecture/architecture-overview.md)
4. **Understanding the Math** → Read [04-domain-engine/overview.md](./04-domain-engine/overview.md)
5. **Understanding Implementation Details** → Read module-specific READMEs

## 🏗️ Development Workflow

This documentation follows IEEE 830 standard for SRS and is designed to:
- ✅ Support investor presentations
- ✅ Enable team onboarding
- ✅ Guide open-source contributions
- ✅ Maintain long-term project knowledge
- ✅ Support architecture evolution

## 📄 Document Conventions

- **Diagrams** use UML 2.5 notation
- **Algorithms** use pseudocode and mathematical notation
- **References** are bidirectional
- **Status**: Each ADR is marked as Proposed, Accepted, or Deprecated

## 🔗 Cross-References

For better navigation:
- Product decisions → ADRs
- Requirements → Architecture mappings
- Architecture → Implementation guides
- Tests → Requirements traceability

---

**Last Updated**: February 2026
**Project**: FindMyStar v1.0
**Total Documentation Files**: 60 Markdown + 13 PlantUML
**Author**: Engineering Team
