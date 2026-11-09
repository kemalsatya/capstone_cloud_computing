# Capstone GitOps Repository

This repository is the deployment source of truth. CI changes the image reference here; Argo CD reconciles the Kubernetes cluster.

Do not put application source code or real secrets in this repository.
