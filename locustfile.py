import uuid
from datetime import datetime
from locust import HttpLocust, TaskSet, task


class UserBehaviour(TaskSet):
    @task(1)
    def login(self):
        self.client.get('/login')

    @task(99)
    def homepage(self):
        self.client.get('/')

    @task(5)
    def user_profile(self):
        self.client.get('/u/aknudsen')

    @task(50)
    def project(self):
        self.client.get('/u/aknudsen/befaco-spring-reverb')

    @task(1)
    def create(self):
        self.client.get('/create')

    @task(1)
    def about(self):
        self.client.get('/about')

    @task(1)
    def forgot_password(self):
        self.client.get('/account/forgotpassword')


class UserLocust(HttpLocust):
    task_set = UserBehaviour
