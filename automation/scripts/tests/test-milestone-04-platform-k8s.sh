#!/usr/bin/env bash
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

print_banner "[M04] Cloud-Native Platform & Kubernetes k3d (LIVE)"

print_step "1. Validasi Dockerfile non-root & render Kustomize (kubectl kustomize deployment/)"
if grep -q "node:22-alpine" "$ROOT_DIR/source/Dockerfile" && grep -q "USER node" "$ROOT_DIR/source/Dockerfile"; then
  record_pass "M04-01 | Dockerfile memakai node:22-alpine & non-root USER node"
else
  record_fail "M04-01 | Dockerfile tidak memenuhi standar non-root node:22-alpine"
fi

if command -v kubectl >/dev/null 2>&1 && (cd "$ROOT_DIR" && kubectl kustomize deployment >/dev/null 2>&1); then
  record_pass "M04-02 | kubectl kustomize deployment/ berhasil dirender tanpa error"
else
  record_fail "M04-02 | kubectl kustomize deployment/ gagal"
fi

print_step "2. Inspeksi live Kubernetes workloads (k3d-capstone, namespace default)"
if command -v kubectl >/dev/null 2>&1 && kubectl get nodes >/dev/null 2>&1; then
  kubectl -n default get deploy,pods,svc,ingress,pvc,hpa -o wide || true

  READY_PODS=$(kubectl -n default get pods -l app=journalfit --no-headers 2>/dev/null | grep -c "Running" || echo "0")
  [[ "$READY_PODS" -ge 2 ]] && record_pass "M04-03 | Live K8s: $READY_PODS pod app=journalfit Running" || record_fail "M04-03 | Pod app=journalfit Running < 2 ($READY_PODS)"

  PVC_PHASE=$(kubectl -n default get pvc journalfit-uploads -o jsonpath='{.status.phase}' 2>/dev/null || echo "Missing")
  [[ "$PVC_PHASE" == "Bound" ]] && record_pass "M04-04 | Live K8s: PVC journalfit-uploads Bound" || record_fail "M04-04 | PVC status=$PVC_PHASE"

  kubectl -n default get hpa journalfit-backend >/dev/null 2>&1 && record_pass "M04-05 | Live K8s: HPA journalfit-backend aktif" || record_fail "M04-05 | HPA tidak ditemukan"

  print_step "3. Uji live Traefik Ingress ($K8S_INGRESS_URL)"
  ING_CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "Host: journalfit.localhost" "$K8S_INGRESS_URL/health/ready" 2>/dev/null || echo "000")
  echo "  GET $K8S_INGRESS_URL/health/ready (Host: journalfit.localhost) -> HTTP $ING_CODE"
  [[ "$ING_CODE" == "200" ]] && record_pass "M04-06 | Live K8s Ingress /health/ready HTTP 200" || record_fail "M04-06 | K8s Ingress HTTP $ING_CODE"
else
  record_skip "M04-03..06 | Kluster k3d belum aktif / kubectl tidak terhubung"
fi

print_step "4. Live Load Balancing & HPA Auto-Scaling Test (opsional: --with-load-test)"
if [[ "$WITH_LOAD_TEST" == "true" ]]; then
  if command -v kubectl >/dev/null 2>&1 && command -v node >/dev/null 2>&1 && curl -fsS -H "Host: journalfit.localhost" "$K8S_INGRESS_URL/health/ready" >/dev/null 2>&1; then
    LOAD_TARGET_REQS="${LOAD_TARGET_REQS:-10000}"
    LOAD_CONCURRENCY="${LOAD_CONCURRENCY:-50}"
    echo "  Target      : $K8S_INGRESS_URL/metrics (Host: journalfit.localhost)"
    echo "  Beban       : ${LOAD_TARGET_REQS} requests (concurrency=${LOAD_CONCURRENCY})"
    echo "  Status awal HPA:"
    kubectl -n default get hpa journalfit-backend || true

    node -e '
      const http = require("http");
      const totalTarget = Number(process.env.LOAD_TARGET_REQS || 10000);
      const concurrency = Number(process.env.LOAD_CONCURRENCY || 50);
      const url = new URL(process.env.K8S_INGRESS_URL || "http://127.0.0.1:8088");
      const agent = new http.Agent({ keepAlive: true, maxSockets: concurrency });
      let sent = 0, done = 0, ok = 0, fail = 0;
      const start = Date.now();
      function fire() {
        if (sent >= totalTarget) return;
        sent++;
        const req = http.request({
          hostname: url.hostname,
          port: url.port || 80,
          path: "/metrics",
          method: "GET",
          headers: { Host: "journalfit.localhost" },
          agent,
          timeout: 5000
        }, (res) => {
          res.resume();
          res.on("end", () => {
            done++;
            if (res.statusCode === 200) ok++; else fail++;
            if (done % 2500 === 0 || done === totalTarget) {
              const sec = ((Date.now() - start) / 1000).toFixed(2);
              console.log(`  [LOAD] ${done}/${totalTarget} req | ok=${ok} fail=${fail} | ${sec}s (${Math.round(done/Math.max(0.1, sec))} req/s)`);
            }
            if (done === totalTarget) {
              agent.destroy();
              process.exit(fail > 0 ? 1 : 0);
            } else {
              fire();
            }
          });
        });
        req.on("error", () => {
          done++; fail++;
          if (done === totalTarget) { agent.destroy(); process.exit(1); } else fire();
        });
        req.end();
      }
      for (let i = 0; i < concurrency; i++) fire();
    ' && LOAD_OK=true || LOAD_OK=false

    echo "  Status HPA & Pods setelah burst ${LOAD_TARGET_REQS} request:"
    kubectl -n default get hpa journalfit-backend || true
    kubectl -n default get pods -l app=journalfit -o wide || true
    kubectl -n default top pods -l app=journalfit 2>/dev/null || true

    if [[ "$LOAD_OK" == "true" ]]; then
      record_pass "M04-07 | Live Load Balancing (${LOAD_TARGET_REQS} req ke K8s Ingress -> 0 failed)"
    else
      record_fail "M04-07 | Live Load Balancing mengalami error request"
    fi
  else
    record_skip "M04-07 | K8s Ingress / kubectl / node belum siap untuk --with-load-test"
  fi
else
  record_skip "M04-07 | Live Load Balancing & HPA test dilewati (tambahkan --with-load-test untuk menembak 10.000 request)"
fi

print_step "5. Verifikasi securityContext manifest & evidence platform"
if grep -q "runAsUser: 10001" "$ROOT_DIR/deployment/deployment.yaml" && grep -q "allowPrivilegeEscalation: false" "$ROOT_DIR/deployment/deployment.yaml"; then
  record_pass "M04-08 | Deployment hardened (UID 10001, allowPrivilegeEscalation: false)"
else
  record_fail "M04-08 | Hardening securityContext belum lengkap"
fi

if [[ -f "$ROOT_DIR/evidence/platform/04_evidence.jpg" && -f "$ROOT_DIR/evidence/platform/README.md" ]]; then
  record_pass "M04-09 | Evidence 04 (04_evidence.jpg & README.md) tersedia"
else
  record_fail "M04-09 | Evidence 04 belum lengkap"
fi

finish_milestone "M04"
