#!/usr/bin/env python3
"""Sync GitHub projects into MuzHack."""
import logging
import os.path
import argparse
import asyncio
import base64
import aiohttp
from aiohttp import web
import yaml


_root_dir = os.path.abspath(os.path.dirname(__file__))
os.chdir(_root_dir)

cl_parser = argparse.ArgumentParser(description='Sync with GitHub projects')
cl_parser.add_argument('--host', help='Database host', default='localhost')
args = cl_parser.parse_args()


logging.basicConfig(format='%(asctime)s %(message)s', level=logging.DEBUG)
_logger = logging.getLogger()


class _NotFoundError(Exception):
    pass


async def _fetch_resource(uri):
    async def fetch():
        async with client.get(uri) as response:
            if response.status == 200:
                response_json = await response.json()
                _logger.debug('Successfully fetched resource {}'.format(uri))
                return response_json
            else:
                _logger.warn(
                    'Failed to fetch resource {}: {}'.format(
                        uri, response.status))
                raise _NotFoundError()

    with aiohttp.ClientSession() as client:
        return await fetch()


async def _read_project_file(owner, repository, filename):
    """Read file from GitHub project."""
    file_uri = 'https://api.github.com/repos/{}/{}/contents/muzhack/{}'.format(
        owner, repository, filename)
    _logger.debug(
        'Reading project file \'{}\', URI: {}'.format(filename, file_uri))
    response_json = await _fetch_resource(file_uri)
    content = base64.b64decode(response_json['content'])
    return content.decode('utf-8')


async def _list_project_dir(owner, repository, dirname):
    """List directory from GitHub project."""
    dir_uri = 'https://api.github.com/repos/{}/{}/contents/muzhack/{}'.format(
        owner, repository, dirname)
    _logger.debug(
        'Reading project directory \'{}\', URI: {}'.format(dirname, dir_uri))
    try:
        response_json = await _fetch_resource(dir_uri)
    except _NotFoundError:
        _logger.debug(
            'Directory \'{}\' not found, defaulting to empty'.format(dirname))
        return []
    else:
        return response_json


async def create_project(request):
    _logger.debug('Received request to create a project')
    params = await request.json()
    owner = params['owner']
    repository = params['repository']
    _logger.info(
        'Asked to create project synced from {}/{}'.format(owner, repository))

    metadata = yaml.load(await _read_project_file(
        owner, repository, 'metadata.yaml'))
    description = await _read_project_file(
        owner, repository, 'description.md')
    instructions = await _read_project_file(
        owner, repository, 'instructions.md')
    print(instructions)

    pictures = await _list_project_dir(owner, repository, 'pictures')
    files = await _list_project_dir(owner, repository, 'files')

    # TODO: Issue API request to MuzHack to create project, with directive
    # to slave it to GitHub repository

    return web.Response()

app = web.Application()
app.router.add_route('POST', '/projects', create_project)

web.run_app(app, port=9000)
