#!/usr/bin/env python3
"""Generate instructions document for a MuzHack-style project."""
import argparse
import os.path
import logging
import yaml
from yamlordereddictloader import Loader as YamlLoader


logging.basicConfig(format='%(asctime)s %(message)s', level=logging.DEBUG)
_logger = logging.getLogger()

cl_parser = argparse.ArgumentParser(
    description='Generate instructions document')
cl_parser.add_argument('directory', help='Directory containing MuzHack files')
cl_parser.add_argument('-o', '--output', help='Output file path')
args = cl_parser.parse_args()

with open(os.path.join(args.directory, 'instructions.md')) as f_instructions:
    instructions = f_instructions.read()


def _generate_bom_tables(component_type2components):
    """Generate Bill Of Materials tables from mapping of component type
    to components."""
    markdown = ''
    for component_type, components in component_type2components.items():
        headers = components[0].keys()
        component_table = """|{}|
|{}|
""".format('|'.join(headers), '|'.join(['-' * len(x) for x in headers]))
        for i, field2value in enumerate(components):
            if sorted(field2value.keys()) != sorted(headers):
                raise Exception(
                    'Component {} of type {} doesn\'t have the expected '
                    'fields ({})'.format(
                        i, component_type, headers
                    ))
            values = [field2value[x] for x in headers]
            string_values = [
                ', '.join(v) if isinstance(v, (list, tuple))
                else str(v)
                for v in values
            ]
            component_table += '|{}|\n'.format('|'.join(string_values))

        markdown += """### {}
{}
""".format(component_type, component_table)

    return markdown


def _read_bom():
    bom_path = os.path.join(args.directory, 'bom.yaml')
    if os.path.exists(bom_path):
        with open(bom_path) as f_bom:
            bom_dict = yaml.load(f_bom.read(), Loader=YamlLoader)

        bom = '# Bill of Materials\n'
        if isinstance(list(bom_dict.values())[0], dict):
            _logger.debug('BOM tables should be divided into sections')
            for k, v in bom_dict.items():
                if not isinstance(v, dict):
                    raise Exception(
                        'BOM entry {} should be a dict, for consistency')
                else:
                    bom_tables = _generate_bom_tables(v)
                    bom += """## {}
{}
""".format(k, bom_tables)
        else:
            _logger.debug('BOM tables should not be divided into sections')
            for k, v in bom_dict.items():
                if not isinstance(v, (list, tuple)):
                    raise Exception(
                        'BOM entry {} should be a list, for consistency')

            bom = _generate_bom_tables(bom_dict)

        bom = bom.strip()
        return '{}\n\n'.format(bom)
    else:
        return ''

bom = _read_bom()

generated_instructions = '{}{}'.format(bom, instructions)
if generated_instructions[-1] != '\n':
    generated_instructions += '\n'
if args.output:
    with open(args.output, 'wt') as f_output:
        f_output.write(generated_instructions)
else:
    print(generated_instructions)
