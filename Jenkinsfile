// Build life-bucket-backend and life-bucket-frontend, import them into the
// node containerd, then upgrade the backend and frontend releases.
// The backend chart also rolls the worker and beat. Postgres and Valkey stay
// as they are.
//
// Create a Pipeline job from SCM and point it at this file. The Jenkins
// Kubernetes cloud must allow a privileged pod: the build uses the node
// Docker socket and the node ctr/helm/kubectl binaries.

pipeline {
    agent {
        kubernetes {
            defaultContainer 'tools'
            yaml '''
apiVersion: v1
kind: Pod
spec:
  hostNetwork: true
  dnsPolicy: ClusterFirstWithHostNet
  restartPolicy: Never
  containers:
    - name: tools
      image: docker:27-cli
      command: ["sleep"]
      args: ["infinity"]
      securityContext:
        privileged: true
      volumeMounts:
        - name: docker-sock
          mountPath: /var/run/docker.sock
        - name: host
          mountPath: /host
  volumes:
    - name: docker-sock
      hostPath:
        path: /var/run/docker.sock
        type: Socket
    - name: host
      hostPath:
        path: /
        type: Directory
'''
        }
    }

    options {
        timestamps()
        disableConcurrentBuilds()
    }

    environment {
        NAMESPACE = 'life-bucket'
        TAG = "${BUILD_NUMBER}"
    }

    stages {
        stage('Build') {
            steps {
                sh '''
                    docker build -t "life-bucket-backend:${TAG}" -t life-bucket-backend:latest ./backend
                    docker build -t "life-bucket-frontend:${TAG}" -t life-bucket-frontend:latest ./frontend
                '''
            }
        }

        stage('Import') {
            steps {
                sh '''
                    docker save "life-bucket-backend:${TAG}" life-bucket-backend:latest \
                        | chroot /host ctr -n k8s.io images import -
                    docker save "life-bucket-frontend:${TAG}" life-bucket-frontend:latest \
                        | chroot /host ctr -n k8s.io images import -
                '''
            }
        }

        stage('Deploy') {
            steps {
                sh '''
                    stage_dir="/tmp/jenkins-life-bucket-${TAG}"
                    rm -rf "/host${stage_dir}"
                    mkdir -p "/host${stage_dir}"
                    cp -a deployment "/host${stage_dir}/deployment"
                    chroot /host su - nvhnam -c "helm upgrade --install backend ${stage_dir}/deployment/backend --namespace ${NAMESPACE} --set image.tag=${TAG}"
                    chroot /host su - nvhnam -c "helm upgrade --install frontend ${stage_dir}/deployment/frontend --namespace ${NAMESPACE} --set image.tag=${TAG}"
                    chroot /host su - nvhnam -c "kubectl --namespace ${NAMESPACE} rollout status deployment/backend --timeout=180s"
                    chroot /host su - nvhnam -c "kubectl --namespace ${NAMESPACE} rollout status deployment/backend-worker --timeout=180s"
                    chroot /host su - nvhnam -c "kubectl --namespace ${NAMESPACE} rollout status deployment/backend-beat --timeout=180s"
                    chroot /host su - nvhnam -c "kubectl --namespace ${NAMESPACE} rollout status deployment/frontend --timeout=180s"
                    rm -rf "/host${stage_dir}"
                '''
            }
        }
    }
}
