# Installing Redis in Your Cluster
Unfortunately this is somewhat of a manual procedure due to Redis' discovery model not mapping
perfectly with Docker/Kubernetes' port mapping model:

1. Create a bootstrap master: `kubectl apply -f docker/production/redis/bootstrap`
2. Create rest of system: `kubectl apply -f docker/production/redis/post-bootstrap`
3. Delete bootstrap master: `kubectl delete -f docker/production/redis/bootstrap`
