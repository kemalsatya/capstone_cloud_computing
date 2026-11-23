import os
import shutil

svg_content = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1620 1380" width="100%" height="100%" style="background:#F4F6F7; font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <defs>
    <filter id="shadow" x="-3%" y="-3%" width="106%" height="106%" filterUnits="userSpaceOnUse">
      <feDropShadow dx="2" dy="3" stdDeviation="3" flood-opacity="0.10" flood-color="#000"/>
    </filter>
    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#2C3E50" />
    </marker>
    <marker id="arrow-sec" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#C0392B" />
    </marker>
    <marker id="arrow-auth" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#8E44AD" />
    </marker>
  </defs>

  <!-- ========================================================================= -->
  <!-- TITLE BLOCK -->
  <!-- ========================================================================= -->
  <rect x="30" y="25" width="1560" height="85" rx="8" fill="#1B365D" filter="url(#shadow)"/>
  <text x="60" y="62" font-size="24" font-weight="bold" fill="#FFFFFF">ArchiMate 3.2 Enterprise Architecture — JournalFit Cloud-Native Platform</text>
  <text x="60" y="90" font-size="13.5" fill="#D0E1F9">Capstone Cloud Computing (Team 7) | Milestone 2 Baseline (main 7e8607b): Keycloak OIDC, Express 5 HPA, pg-boss Worker, PostgreSQL 17 &amp; GitOps</text>
  <rect x="1370" y="45" width="190" height="42" rx="6" fill="#27AE60"/>
  <text x="1465" y="71" font-size="13" font-weight="bold" fill="#FFF" text-anchor="middle">M2 VERIFIED BASELINE</text>

  <!-- ========================================================================= -->
  <!-- 1. BUSINESS LAYER -->
  <!-- ========================================================================= -->
  <rect x="30" y="130" width="1560" height="235" rx="10" fill="#FFFDE7" stroke="#FBC02D" stroke-width="2" filter="url(#shadow)"/>
  <rect x="40" y="140" width="300" height="30" rx="6" fill="#FFF9C4" stroke="#FBC02D"/>
  <text x="50" y="160" font-size="14" font-weight="bold" fill="#7F6000">1. BUSINESS ARCHITECTURE LAYER</text>

  <!-- Business Actors -->
  <g transform="translate(60, 190)">
    <!-- Actor Author -->
    <rect x="0" y="0" width="190" height="75" rx="6" fill="#FFF2B2" stroke="#D4AC0D" stroke-width="1.5" filter="url(#shadow)"/>
    <circle cx="35" cy="38" r="16" fill="#FFE082" stroke="#D4AC0D"/>
    <path d="M 35 28 A 5 5 0 1 0 35 38 A 5 5 0 1 0 35 28 Z M 27 50 C 27 43 43 43 43 50 Z" fill="#B7950B"/>
    <text x="65" y="33" font-size="13" font-weight="bold" fill="#1C2833">Author</text>
    <text x="65" y="50" font-size="11" fill="#5D6D7E">Penulis Naskah</text>
    <text x="65" y="64" font-size="10" fill="#7F8C8D">(Submitter Role)</text>
  </g>

  <g transform="translate(60, 280)">
    <!-- Actor Editor -->
    <rect x="0" y="0" width="190" height="70" rx="6" fill="#FFF2B2" stroke="#D4AC0D" stroke-width="1.5" filter="url(#shadow)"/>
    <circle cx="35" cy="35" r="16" fill="#FFE082" stroke="#D4AC0D"/>
    <path d="M 35 25 A 5 5 0 1 0 35 35 A 5 5 0 1 0 35 25 Z M 27 47 C 27 40 43 40 43 47 Z" fill="#B7950B"/>
    <text x="65" y="32" font-size="13" font-weight="bold" fill="#1C2833">Journal Editor</text>
    <text x="65" y="49" font-size="11" fill="#5D6D7E">Pengelola Jurnal</text>
    <text x="65" y="63" font-size="10" fill="#7F8C8D">(Reviewer Role)</text>
  </g>

  <!-- Business Services -->
  <g transform="translate(290, 190)">
    <rect x="0" y="0" width="260" height="70" rx="6" fill="#FFF9C4" stroke="#D4AC0D" stroke-width="1.5" filter="url(#shadow)"/>
    <text x="15" y="26" font-size=\"12.5\" font-weight=\"bold\" fill=\"#7D6608\">Single Sign-On Auth Service</text>
    <text x="15" y="44" font-size=\"11\" fill=\"#5D6D7E\">Multi-Tenant Identity &amp; RBAC Login</text>
    <text x="15" y="60" font-size=\"10\" fill=\"#27AE60\">OAuth2 / OIDC Password Flow</text>

    <rect x="0" y="90" width="260" height="70" rx="6" fill="#FFF9C4" stroke="#D4AC0D" stroke-width="1.5" filter="url(#shadow)"/>
    <text x="15" y="116" font-size=\"12.5\" font-weight=\"bold\" fill=\"#7D6608\">Format Rules Management</text>
    <text x="15" y="134" font-size=\"11\" fill=\"#5D6D7E\">Config template aturan per jurnal</text>
    <text x="15" y="150" font-size=\"10\" fill=\"#2980B9\">IEEE / APA / Nature presets</text>
  </g>

  <!-- Core Business Process -->
  <g transform="translate(580, 190)">
    <rect x="0" y="0" width="980" height="160" rx="8" fill="#FEF9E7" stroke="#F39C12" stroke-width="1.5" stroke-dasharray="4"/>
    <text x="15" y="24" font-size="12" font-weight="bold" fill="#B9770E">Core Business Process: Pre-Submission Manuscript Compliance Lifecycle</text>
    
    <!-- Step 1 -->
    <rect x="25" y="42" width="210" height="100" rx="6" fill="#FFF2B2" stroke="#D4AC0D" stroke-width="1.5" filter="url(#shadow)"/>
    <circle cx="45" cy="62" r="10" fill="#B7950B"/>
    <text x="45" y="66" font-size="11" font-weight="bold" fill="#FFF" text-anchor="middle">1</text>
    <text x="65" y="62" font-size="12" font-weight="bold" fill="#1C2833">Tenant Authentication</text>
    <text x="35" y="86" font-size="10.5" fill="#424949">Author/Editor input creds</text>
    <text x="35" y="103" font-size="10" fill="#27AE60">Receive RS256 Bearer JWT</text>
    <text x="35" y="120" font-size="9.5" fill="#7F8C8D">Tenant-ID claim embedded</text>

    <!-- Arrow -->
    <path d="M 240 92 L 265 92" stroke="#2C3E50" stroke-width="2" marker-end="url(#arrow)"/>

    <!-- Step 2 -->
    <rect x="270" y="42" width="210" height="100" rx="6" fill="#FFF2B2" stroke="#D4AC0D" stroke-width="1.5" filter="url(#shadow)"/>
    <circle cx="290" cy="62" r="10" fill="#B7950B"/>
    <text x="290" y="66" font-size="11" font-weight="bold" fill="#FFF" text-anchor="middle">2</text>
    <text x="310" y="62" font-size="12" font-weight="bold" fill="#1C2833">Submit &amp; Enqueue</text>
    <text x="280" y="86" font-size="10.5" fill="#424949">POST /api/manuscripts (202)</text>
    <text x="280" y="103" font-size="10" fill="#2980B9">PVC 1Gi + pg-boss Job</text>
    <text x="280" y="120" font-size="9.5" fill="#7F8C8D">Atomic DB TX + format-check</text>

    <!-- Arrow -->
    <path d="M 485 92 L 510 92" stroke="#2C3E50" stroke-width="2" marker-end="url(#arrow)"/>

    <!-- Step 3 -->
    <rect x="515" y="42" width="210" height="100" rx="6" fill="#FFF2B2" stroke="#D4AC0D" stroke-width="1.5" filter="url(#shadow)"/>
    <circle cx="535" cy="62" r="10" fill="#B7950B"/>
    <text x="535" y="66" font-size="11" font-weight="bold" fill="#FFF" text-anchor="middle">3</text>
    <text x="555" y="62" font-size="12" font-weight="bold" fill="#1C2833">Async OOXML Audit</text>
    <text x="525" y="86" font-size="10.5" fill="#424949">worker-format (jszip/XML)</text>
    <text x="525" y="103" font-size="10" fill="#C0392B">Tier-1 Rules FMT-001..009</text>
    <text x="525" y="120" font-size="9.5" fill="#27AE60">Deterministic $0 AI Token Fee</text>

    <!-- Arrow -->
    <path d="M 730 92 L 755 92" stroke="#2C3E50" stroke-width="2" marker-end="url(#arrow)"/>

    <!-- Step 4 -->
    <rect x="760" y="42" width="200" height="100" rx="6" fill="#FFF2B2" stroke="#D4AC0D" stroke-width="1.5" filter="url(#shadow)"/>
    <circle cx="780" cy="62" r="10" fill="#B7950B"/>
    <text x="780" y="66" font-size="11" font-weight="bold" fill="#FFF" text-anchor="middle">4</text>
    <text x="800" y="62" font-size="12" font-weight="bold" fill="#1C2833">Findings &amp; Report</text>
    <text x="770" y="86" font-size="10.5" fill="#424949">Generate format_score</text>
    <text x="770" y="103" font-size="10" fill="#2980B9">Instant Report (&lt; 50 ms)</text>
    <text x="770" y="120" font-size="9.5" fill="#8E44AD">Cross-tenant blocked (404)</text>
  </g>

  <!-- ========================================================================= -->
  <!-- 2. APPLICATION LAYER -->
  <!-- ========================================================================= -->
  <rect x="30" y="385" width="1560" height="425" rx="10" fill="#EBF5FB" stroke="#2980B9" stroke-width="2" filter="url(#shadow)"/>
  <rect x="40" y="395" width="330" height="30" rx="6" fill="#D4E6F1" stroke="#2980B9"/>
  <text x="50" y="415" font-size="14" font-weight="bold" fill="#1B4F72">2. APPLICATION ARCHITECTURE LAYER</text>

  <!-- Traefik Ingress Gateway (Application Interface) -->
  <g transform="translate(60, 440)">
    <rect x="0" y="0" width="1500" height="58" rx="6" fill="#B3E5FC" stroke="#0288D1" stroke-width="2" filter="url(#shadow)"/>
    <text x="20" y="32" font-size="14" font-weight="bold" fill="#01579B">Traefik Ingress Gateway (HTTP Entrypoint :8088)</text>
    <rect x="470" y="12" width="345" height="34" rx="4" fill="#E1F5FE" stroke="#0288D1"/>
    <text x="480" y="33" font-size="11.5" fill="#0277BD">Host: <tspan font-weight="bold">journalfit.localhost</tspan> → Service: journalfit-backend:80</text>
    <rect x="830" y="12" width="335" height="34" rx="4" fill="#E1F5FE" stroke="#0288D1"/>
    <text x="840" y="33" font-size="11.5" fill="#0277BD">Host: <tspan font-weight="bold">keycloak.localhost</tspan> → Service: keycloak:80</text>
    <rect x="1185" y="12" width="295" height="34" rx="4" fill="#FFF9C4" stroke="#FBC02D"/>
    <text x="1195" y="33" font-size="11.5" font-weight="bold" fill="#B7950B">[TB-1] Perimeter Trust Boundary</text>
  </g>

  <!-- Keycloak Component -->
  <g transform="translate(60, 520)">
    <rect x="0" y="0" width="415" height="270" rx="8" fill="#BBE0F2" stroke="#1F618D" stroke-width="1.5" filter="url(#shadow)"/>
    <rect x="10" y="10" width="395" height="30" rx="4" fill="#A9CCE3"/>
    <text x="20" y="30" font-size="13" font-weight="bold" fill="#154360">Keycloak OIDC Provider (Quarkus JVM)</text>
    <text x="20" y="60" font-size="11" fill="#2C3E50">Realm: <tspan font-weight="bold">journalfit</tspan> | Client: <tspan font-weight="bold">journalfit-app</tspan></text>
    <text x="20" y="78" font-size="10.5" fill="#566573">Protocol: OpenID Connect 1.0 (Direct Grants / Password Flow)</text>
    
    <!-- Endpoints inside Keycloak -->
    <rect x="15" y="94" width="385" height="60" rx="5" fill="#EBF5FB" stroke="#2980B9" stroke-width="1"/>
    <text x="25" y="114" font-size="11" font-weight="bold" fill="#1B4F72">Token Issuer Endpoint (External)</text>
    <text x="25" y="130" font-size="9.5" fill="#27AE60">POST /realms/journalfit/protocol/openid-connect/token</text>
    <text x="25" y="145" font-size="9.5" fill="#7F8C8D">Injects claim: tenant_id, role, sub, iss, exp</text>

    <rect x="15" y="165" width="385" height="60" rx="5" fill="#EBF5FB" stroke="#2980B9" stroke-width="1"/>
    <text x="25" y="185" font-size="11" font-weight="bold" fill="#1B4F72">JWKS Public Keys Endpoint (Internal)</text>
    <text x="25" y="201" font-size="9.5" fill="#8E44AD">GET /realms/journalfit/protocol/openid-connect/certs</text>
    <text x="25" y="216" font-size="9" fill="#7F8C8D">RS256 | DNS: http://keycloak.default.svc.cluster.local</text>

    <!-- Keycloak Badge -->
    <rect x="15" y="235" width="385" height="24" rx="4" fill="#FCF3CF" stroke="#F39C12"/>
    <text x="207" y="251" font-size="10" font-weight="bold" fill="#7D6608" text-anchor="middle">Resource Footprint: ~596 MiB RAM | Cold Start ~72s</text>
  </g>

  <!-- Connective Arrows Keycloak to Backend -->
  <path d="M 477 690 L 543 690" stroke="#8E44AD" stroke-width="2.5" stroke-dasharray="4" marker-end="url(#arrow-auth)"/>
  <rect x="480" y="662" width="60" height="18" rx="3" fill="#F5EEF8" stroke="#8E44AD" stroke-width="0.8"/>
  <text x="510" y="674" font-size="9.5" font-weight="bold" fill="#8E44AD" text-anchor="middle">JWKS Keys</text>

  <!-- JournalFit Modular Monolith Backend Component -->
  <g transform="translate(545, 520)">
    <rect x="0" y="0" width="635" height="270" rx="8" fill="#BBE0F2" stroke="#1F618D" stroke-width="1.5" filter="url(#shadow)"/>
    <rect x="10" y="10" width="615" height="30" rx="4" fill="#A9CCE3"/>
    <text x="20" y="30" font-size="13" font-weight="bold" fill="#154360">JournalFit Modular Monolith Backend (Express 5)</text>
    
    <!-- Sub-components Grid -->
    <!-- 1. Auth & Claims -->
    <rect x="15" y="52" width="295" height="98" rx="5" fill="#EBF5FB" stroke="#2980B9" stroke-width="1"/>
    <text x="25" y="72" font-size="11.5" font-weight="bold" fill="#1B4F72">Auth &amp; Claims Middleware (jose)</text>
    <text x="25" y="90" font-size="10" fill="#27AE60">• Validates RS256 via cached JWKS</text>
    <text x="25" y="105" font-size="10" fill="#C0392B">• Reads tenant_id (Ignores X-Tenant-ID)</text>
    <text x="25" y="120" font-size="10" fill="#8E44AD">• RBAC Guard: author vs editor (403)</text>
    <text x="25" y="135" font-size="10" fill="#154360">• Multi-Tenant Guard: Cross-tenant (404)</text>

    <!-- 2. Manuscript Upload & Queue -->
    <rect x="320" y="52" width="300" height="98" rx="5" fill="#EBF5FB" stroke="#2980B9" stroke-width="1"/>
    <text x="330" y="72" font-size="11.5" font-weight="bold" fill="#1B4F72">Submission, Storage &amp; Queue (pg-boss)</text>
    <text x="330" y="90" font-size="10" fill="#2C3E50">• POST /api/manuscripts (202) &amp; /upload</text>
    <text x="330" y="105" font-size="10" fill="#2980B9">• Atomic enqueue: format-check (+ DLQ)</text>
    <text x="330" y="120" font-size="10" fill="#27AE60">• Mounts PVC local-path: /app/uploads</text>
    <text x="330" y="135" font-size="9.5" fill="#7F8C8D">• Ownership pinned to req.user.tenant_id</text>

    <!-- 3. OOXML Parser & Tier-1 Rule Engine -->
    <rect x="15" y="158" width="295" height="98" rx="5" fill="#EBF5FB" stroke="#2980B9" stroke-width="1"/>
    <text x="25" y="178" font-size="11.5" font-weight="bold" fill="#1B4F72">Async Worker &amp; OOXML Rule Engine</text>
    <text x="25" y="196" font-size="10" fill="#2C3E50">• worker-format (jszip + fast-xml-parser)</text>
    <text x="25" y="211" font-size="10" fill="#27AE60">• Tier-1 Rules: FMT-001..009 (A4, font, abs)</text>
    <text x="25" y="226" font-size="10" fill="#27AE60">• Idempotent job handler + retry/DLQ</text>
    <text x="25" y="241" font-size="9.5" fill="#C0392B">• Deterministic $0 AI fee | format_score</text>

    <!-- 4. Telemetry, OpenAPI & Probes -->
    <rect x="320" y="158" width="300" height="98" rx="5" fill="#EBF5FB" stroke="#2980B9" stroke-width="1"/>
    <text x="330" y="178" font-size="11.5" font-weight="bold" fill="#1B4F72">Telemetry, OpenAPI Docs &amp; Reports</text>
    <text x="330" y="196" font-size="10" fill="#2C3E50">• /health/live &amp; /health/ready (DB + Queue)</text>
    <text x="330" y="211" font-size="10" fill="#27AE60">• /docs &amp; /openapi.yaml (Swagger UI)</text>
    <text x="330" y="226" font-size="10" fill="#8E44AD">• GET /metrics (API :8000 &amp; Worker :9101)</text>
    <text x="330" y="241" font-size="10" fill="#2980B9">• GET /api/manuscripts/:id/report</text>
  </g>

  <!-- Data Objects (ArchiMate Data Objects) -->
  <g transform=\"translate(1210, 520)\">
    <rect x="0" y="0" width="350" height="270" rx="8" fill="#D4E6F1" stroke="#2471A3" stroke-width="1.5" filter="url(#shadow)"/>
    <text x="15" y="26" font-size="13" font-weight="bold" fill="#1A5276">Application Data Objects</text>
    
    <rect x="15" y="42" width="320" height="46" rx="4" fill="#FFF" stroke="#85929E"/>
    <text x="25" y="60" font-size="11" font-weight="bold" fill="#1C2833">Bearer JWT Access Token</text>
    <text x="25" y="76" font-size="9.5" fill="#7F8C8D">Claims: iss, sub, tenant_id, roles (RS256)</text>

    <rect x="15" y="98" width="320" height="46" rx="4" fill="#FFF" stroke="#85929E"/>
    <text x="25" y="116" font-size="11" font-weight="bold" fill="#1C2833">Manuscript Upload File (.docx)</text>
    <text x="25" y="132" font-size="9.5" fill="#7F8C8D">Binary stored on PVC /app/uploads</text>

    <rect x="15" y="154" width="320" height="46" rx="4" fill="#FFF" stroke="#85929E"/>
    <text x="25" y="172" font-size="11" font-weight="bold" fill="#1C2833">Format Rule Template</text>
    <text x="25" y="188" font-size="9.5" fill="#7F8C8D">Tenant-scoped formatting thresholds</text>

    <rect x="15" y="210" width="320" height="46" rx="4" fill="#FFF" stroke="#85929E"/>
    <text x="25" y="228" font-size="11" font-weight="bold" fill="#1C2833">Audit Report &amp; Findings</text>
    <text x="25" y="244" font-size="9.5" fill="#7F8C8D">format_score (85), check_results, findings</text>
  </g>

  <!-- ========================================================================= -->
  <!-- 3. TECHNOLOGY & INFRASTRUCTURE LAYER -->
  <!-- ========================================================================= -->
  <rect x="30" y="830" width="1560" height="515" rx="10" fill="#E8F8F5" stroke="#27AE60" stroke-width="2" filter="url(#shadow)"/>
  <rect x="40" y="840" width="380" height="30" rx="6" fill="#D5F5E3" stroke="#27AE60"/>
  <text x="50" y="860" font-size="14" font-weight="bold" fill="#145A32">3. TECHNOLOGY &amp; INFRASTRUCTURE ARCHITECTURE LAYER</text>

  <!-- Kubernetes Cluster Node (k3d-capstone) -->
  <g transform="translate(60, 885)">
    <rect x="0" y="0" width="870" height="440" rx="8" fill="#C8E6C9" stroke="#27AE60" stroke-width="1.5" filter="url(#shadow)"/>
    <text x="15" y="26" font-size="13" font-weight="bold" fill="#1E8449">Kubernetes Cluster: k3d-capstone (k3s v1.31-k3s1)</text>

    <!-- Worker Node k3d-capstone-agent-0 -->
    <rect x="15" y="42" width="840" height="385" rx="6" fill="#E8F5E9" stroke="#4CAF50" stroke-width="1.5"/>
    <text x="25" y="63" font-size="12" font-weight="bold" fill="#2E7D32">Worker Node: k3d-capstone-agent-0 (Containerd Runtime)</text>

    <!-- Pod Keycloak -->
    <rect x="25" y="78" width="385" height="130" rx="5" fill="#FFFFFF" stroke="#388E3C" stroke-width="1.5"/>
    <rect x="35" y="88" width="365" height="24" rx="3" fill="#E8F5E9"/>
    <text x="45" y="104" font-size="11" font-weight="bold" fill="#1B5E20">Pod: keycloak (1 Replica - Recreate)</text>
    <text x="45" y="126" font-size="10" fill="#2C3E50">Image: <tspan font-weight="bold">quay.io/keycloak/keycloak:26.8.2</tspan></text>
    <text x="45" y="142" font-size="10" fill="#558B2F">Security: <tspan font-weight="bold">runAsUser: 1000</tspan> | drop ALL (Non-Root)</text>
    <text x="45" y="158" font-size="10" fill="#2E7D32">Resources: <tspan font-weight="bold">Requests 250m/512Mi | Limits 1000m/1Gi</tspan></text>
    <text x="45" y="174" font-size="10" fill="#C0392B">Service: keycloak (ClusterIP :80 → :8080 | Mgmt :9000)</text>
    <text x="45" y="190" font-size="9.5" fill="#7F8C8D">Secrets: keycloak-db-secret &amp; keycloak-admin-secret</text>

    <!-- Pod Backend (2-3 pods) -->
    <rect x="430" y="78" width="415" height="130" rx="5" fill="#FFFFFF" stroke="#388E3C" stroke-width="1.5"/>
    <rect x="440" y="88" width="395" height="24" rx="3" fill="#E8F5E9"/>
    <text x="450" y="104" font-size="11" font-weight="bold" fill="#1B5E20">Pods: backend (2-3 HPA) + worker-format (1) + db-setup Job</text>
    <text x="450" y="126" font-size="10" fill="#2C3E50">Image: <tspan font-weight="bold">registry:5000/journalfit-backend:0c2cf92</tspan> (node:22-alpine)</text>
    <text x="450" y="142" font-size="10" fill="#C0392B">Security: <tspan font-weight="bold">UID 10001 | drop ALL | allowPrivilegeEscalation: false</tspan></text>
    <text x="450" y="158" font-size="10" fill="#2E7D32">Resources: <tspan font-weight="bold">Req 100m/128Mi | Lim 250m/256Mi</tspan> (API &amp; Worker)</text>
    <text x="450" y="174" font-size="10" fill="#1E8449">API :80→:8000 | Worker Metrics :9101 | Job: migrate+seed</text>
    <text x="450" y="190" font-size="9.5" fill="#8E44AD">HPA: min: 2, max: 3 @ 70% CPU | Readiness: /health/ready</text>

    <!-- Storage Volume PVC -->
    <rect x="25" y="222" width="385" height="85" rx="5" fill="#FADBD8" stroke="#C0392B" stroke-width="1.5"/>
    <text x="35" y="242" font-size="11" font-weight="bold" fill="#78281F">Storage Volume: journalfit-uploads PVC (1Gi)</text>
    <text x="35" y="260" font-size="10" fill="#922B21">AccessMode: ReadWriteOnce (RWO) | StorageClass: local-path</text>
    <text x="35" y="276" font-size="10" fill="#78281F">MountPath: /app/uploads (Shared by API &amp; worker-format)</text>
    <text x="35" y="292" font-size="9.5" fill="#C0392B">[FB-2] Pinned to k3d-capstone-agent-0 (Single-node boundary)</text>

    <!-- K8s Secrets & ConfigMaps -->
    <rect x="430" y="222" width="415" height="85" rx="5" fill="#FCF3CF" stroke="#B7950B" stroke-width="1.5"/>
    <text x="440" y="242" font-size="11" font-weight="bold" fill="#7D6608">Kubernetes Configuration &amp; Secret Isolation</text>
    <text x="440" y="260" font-size="10" fill="#2C3E50">• Secret: <tspan font-weight="bold">journalfit-backend-secret</tspan> (DB_PASSWORD via secretKeyRef)</text>
    <text x="440" y="276" font-size="10" fill="#2C3E50">• ConfigMap: <tspan font-weight="bold">journalfit-backend-config</tspan> (DB_HOST, AUTH_MODE=jwt)</text>
    <text x="440" y="292" font-size="9.5" fill="#27AE60">[TB-4] Least Privilege: automountServiceAccountToken: false</text>

    <!-- Cluster Bottom Bar: Self Healing Metric -->
    <rect x="25" y="322" width="820" height="42" rx="4" fill="#E8F8F5" stroke="#16A085"/>
    <text x="435" y="348" font-size="11.5" font-weight="bold" fill="#0E6251" text-anchor="middle">[FB-1] Verified Pod Self-Healing: 7.1 detik (08_evidence) | Rolling Update: 777 Req, 0 Failed, p95 26.73 ms</text>
  </g>

  <!-- Host & Docker Engine Node (Database & Observability) -->
  <g transform="translate(950, 885)">
    <rect x="0" y="0" width="320" height="440" rx="8" fill="#C8E6C9" stroke="#27AE60" stroke-width="1.5" filter="url(#shadow)"/>
    <text x="15" y="26" font-size="13" font-weight="bold" fill="#1E8449">Host Node: Docker Engine</text>

    <!-- PostgreSQL Container -->
    <rect x="15" y="42" width="290" height="185" rx="6" fill="#FFFFFF" stroke="#2980B9" stroke-width="1.5"/>
    <rect x="25" y="52" width="270" height="24" rx="3" fill="#EBF5FB"/>
    <text x="35" y="68" font-size="11" font-weight="bold" fill="#1B4F72">PostgreSQL 17 Alpine Container</text>
    <text x="35" y="92" font-size="10" fill="#2C3E50">Container: <tspan font-weight="bold">journalfit-postgres</tspan> (:5432)</text>
    <text x="35" y="108" font-size="10" fill="#27AE60">Database 1: <tspan font-weight="bold">journalfit</tspan> (6 Tables)</text>
    <text x="45" y="123" font-size="9" fill="#566573">• tenants, users, format_rule_templates,</text>
    <text x="45" y="136" font-size="9" fill="#566573">• manuscripts, check_results, findings</text>
    <text x="35" y="153" font-size="10" fill="#8E44AD">Database 2: <tspan font-weight="bold">keycloak</tspan> (101 Tables)</text>
    <text x="35" y="172" font-size="10" fill="#C0392B">Actual Restore RTO: <tspan font-weight="bold">0.78 Detik</tspan> (08)</text>
    <text x="35" y="188" font-size="9.5" fill="#78281F">[FB-3] Target SLO: &lt; 300 Detik (PASS)</text>

    <!-- Observability Stack -->
    <rect x="15" y="240" width="290" height="185" rx="6" fill="#FFFFFF" stroke="#E67E22" stroke-width="1.5"/>
    <rect x="25" y="250" width="270" height="24" rx="3" fill="#FDF2E9"/>
    <text x="35" y="266" font-size="11" font-weight="bold" fill="#A04000">Observability Stack (Prometheus)</text>
    <text x="35" y="292" font-size="10" fill="#2C3E50">Prometheus Container: <tspan font-weight="bold">:9090</tspan></text>
    <text x="35" y="308" font-size="9.5" fill="#7F8C8D">• Scrapes GET /metrics every 15s</text>
    <text x="35" y="324" font-size="9.5" fill="#7F8C8D">• TSDB Retention: 3 Days (Disk control)</text>
    <text x="35" y="344" font-size="10" fill="#2C3E50">Grafana Dashboard Container: <tspan font-weight="bold">:3000</tspan></text>
    <text x="35" y="360" font-size="9.5" fill="#27AE60">• 4 Golden Signals Dashboard</text>
    <text x="35" y="376" font-size="9.5" fill="#27AE60">• Evaluates Target SLO: 95% &lt; 30s</text>
  </g>

  <!-- CI/CD & Delivery Control Plane Node -->
  <g transform="translate(1290, 885)">
    <rect x="0" y="0" width="280" height="440" rx="8" fill="#E8DAEF" stroke="#8E44AD" stroke-width="1.5" filter="url(#shadow)"/>
    <text x="15" y="26" font-size="12.5" font-weight="bold" fill="#512E5F">CI/CD Control Plane</text>
    <text x="15" y="44" font-size="10" fill="#7D3C98">Out-of-Band Delivery Pipeline</text>

    <!-- GitHub Actions -->
    <rect x="15" y="58" width="250" height="110" rx="5" fill="#FFFFFF" stroke="#8E44AD" stroke-width="1.5"/>
    <text x="25" y="79" font-size="11" font-weight="bold" fill="#4A235A">GitHub Actions CI</text>
    <text x="25" y="97" font-size="10" fill="#27AE60">• Automated node --test &amp; Auth Suite</text>
    <text x="25" y="113" font-size="10" fill="#C0392B">• Trivy Container Scan Gate</text>
    <text x="25" y="128" font-size="9.5" fill="#7F8C8D">  (Severity: HIGH,CRITICAL)</text>
    <text x="25" y="144" font-size="10" fill="#2980B9">• Immutable SHA-7 Tagging</text>

    <!-- Local OCI Registry -->
    <rect x="15" y="180" width="250" height="80" rx="5" fill="#FFFFFF" stroke="#8E44AD" stroke-width="1.5"/>
    <text x="25" y="201" font-size="11" font-weight="bold" fill="#4A235A">Local OCI Registry (:5001 / :5000)</text>
    <text x="25" y="219" font-size="10" fill="#2C3E50">Artifact Repository (registry:5000)</text>
    <text x="25" y="234" font-size="9.5" fill="#27AE60">• Tag: journalfit-backend:0c2cf92</text>
    <text x="25" y="249" font-size="9.5" fill="#7F8C8D">• Linked to k3d containerd</text>

    <!-- Argo CD -->
    <rect x="15" y="272" width="250" height="150" rx="5" fill="#FFFFFF" stroke="#8E44AD" stroke-width="1.5"/>
    <text x="25" y="293" font-size="11" font-weight="bold" fill="#4A235A">Argo CD GitOps Controller</text>
    <text x="25" y="311" font-size="10" fill="#27AE60">• Auto-Sync &amp; Self-Healing</text>
    <text x="25" y="327" font-size="10" fill="#2C3E50">• Target Git: main branch</text>
    <text x="25" y="343" font-size="10" fill="#2980B9">• Kustomize Manifest Deploy</text>
    <text x="25" y="359" font-size="9.5" fill="#7F8C8D">• Status: Synced &amp; Healthy</text>
    <text x="25" y="377" font-size="10" font-weight="bold" fill="#C0392B">• Rollback Time: &lt; 15 detik</text>
  </g>

</svg>"""

# Write SVG to capstone_cloud_computing/architecture
os.makedirs("capstone_cloud_computing/architecture", exist_ok=True)
with open("capstone_cloud_computing/architecture/archimate-diagram.svg", "w", encoding="utf-8") as f:
    f.write(svg_content)

# Write interactive HTML viewer
html_content = f"""<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>ArchiMate 3.2 Diagram — JournalFit Platform (Team 7)</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {{
      margin: 0;
      padding: 0;
      background-color: #1A252F;
      font-family: 'Segoe UI', Roboto, sans-serif;
      color: #ECEFF1;
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }}
    header {{
      background: #0E171E;
      padding: 12px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #2C3E50;
    }}
    header h1 {{
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #FFFFFF;
    }}
    header .badge {{
      background: #27AE60;
      color: #FFF;
      font-size: 11px;
      font-weight: bold;
      padding: 4px 10px;
      border-radius: 4px;
      margin-left: 12px;
    }}
    .actions button {{
      background: #2980B9;
      color: #FFF;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-weight: bold;
      font-size: 13px;
      margin-left: 8px;
      transition: background 0.2s;
    }}
    .actions button:hover {{
      background: #3498DB;
    }}
    #viewer-container {{
      flex: 1;
      overflow: auto;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding: 24px;
      background: #2C3E50;
    }}
    .svg-wrapper {{
      background: #FFFFFF;
      box-shadow: 0 10px 30px rgba(0,0,0,0.4);
      border-radius: 8px;
      max-width: 1620px;
      width: 100%;
    }}
    footer {{
      background: #0E171E;
      padding: 8px 24px;
      font-size: 12px;
      color: #90A4AE;
      display: flex;
      justify-content: space-between;
      border-top: 1px solid #2C3E50;
    }}
  </style>
</head>
<body>
  <header>
    <div style="display: flex; align-items: center;">
      <h1>JournalFit — ArchiMate 3.2 Architecture Diagram</h1>
      <span class="badge">Milestone 2 Verified Baseline</span>
    </div>
    <div class="actions">
      <button onclick="window.print()">Print / Export PDF</button>
      <button onclick="downloadSVG()">Download SVG</button>
    </div>
  </header>
  <div id="viewer-container">
    <div class="svg-wrapper">
      {svg_content}
    </div>
  </div>
  <footer>
    <span>Open Group ArchiMate 3.2 Notation | Layers: Business (Yellow), Application (Blue), Technology (Green)</span>
    <span>Capstone Cloud Computing Tim 7 • Liaurentino</span>
  </footer>

  <script>
    function downloadSVG() {{
      const svg = document.querySelector('svg');
      const serializer = new XMLSerializer();
      let source = serializer.serializeToString(svg);
      const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(source);
      const a = document.createElement('a');
      a.href = url;
      a.download = "02_evidence_archimate_journalfit.svg";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }}
  </script>
</body>
</html>"""

with open("capstone_cloud_computing/architecture/archimate-diagram.html", "w", encoding="utf-8") as f:
    f.write(html_content)

# Copy to portfolio folder cloud-capstone-team-7/02-architecture
os.makedirs("cloud-capstone-team-7/02-architecture", exist_ok=True)
shutil.copy("capstone_cloud_computing/architecture/archimate-diagram.svg", "cloud-capstone-team-7/02-architecture/archimate-diagram.svg")
shutil.copy("capstone_cloud_computing/architecture/archimate-diagram.html", "cloud-capstone-team-7/02-architecture/archimate-diagram.html")
shutil.copy("capstone_cloud_computing/architecture/archimate-model.puml", "cloud-capstone-team-7/02-architecture/archimate-model.puml")

print("ArchiMate SVG, HTML, and PUML generated and synced locally!")
