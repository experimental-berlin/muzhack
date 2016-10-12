import uuid
from datetime import datetime
from locust import HttpLocust, TaskSet, task


class UserBehaviour(TaskSet):
    @task(1)
    def user(self):
        self.client.get('/login', {"deviceid": self._deviceid})

    @task(999)
    def post_metrics(self):
        self.client.post(
            "/metrics",
            {
                "deviceid": self._deviceid, "timestamp": datetime.now(),
            }
        )


class UserLocust(HttpLocust):
    task_set = UserBehaviour
