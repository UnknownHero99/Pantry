"""Minimal reader/writer for KiCad's s-expression files."""
import re

class Str(str):
	"""A quoted string, so it is written back with quotes."""

TOKEN = re.compile(r'\s*(?:(\()|(\))|"((?:[^"\\]|\\.)*)"|([^\s()"]+))', re.S)

def parse(text):
	stack, out = [], None
	pos = 0
	while True:
		m = TOKEN.match(text, pos)
		if not m:
			break
		pos = m.end()
		op, cl, q, atom = m.groups()
		if op:
			stack.append([])
		elif cl:
			done = stack.pop()
			if stack:
				stack[-1].append(done)
			else:
				out = done
		elif q is not None:
			stack[-1].append(Str(q.replace('\\"', '"').replace('\\\\', '\\')))
		elif atom is not None:
			stack[-1].append(atom)
	return out

def dump(node, indent=0):
	if isinstance(node, list):
		if all(not isinstance(c, list) for c in node):
			return '(' + ' '.join(dump(c) for c in node) + ')'
		pad = '\t' * (indent + 1)
		head = [c for c in node if not isinstance(c, list)]
		parts = ['(' + ' '.join(dump(c) for c in head)]
		for c in node:
			if isinstance(c, list):
				parts.append('\n' + pad + dump(c, indent + 1))
		return ''.join(parts) + '\n' + '\t' * indent + ')'
	if isinstance(node, Str):
		return '"' + node.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n') + '"'
	if isinstance(node, float):
		return f'{node:.4f}'.rstrip('0').rstrip('.')
	return str(node)

def find(node, key):
	"""First child list whose head is key."""
	return next((c for c in node if isinstance(c, list) and c and c[0] == key), None)

def find_all(node, key):
	return [c for c in node if isinstance(c, list) and c and c[0] == key]
