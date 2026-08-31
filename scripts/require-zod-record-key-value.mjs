const requireZodRecordKeyValue = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require z.record() to define both key and value schemas.',
    },
    schema: [],
    messages: {
      missingKeyValueSchemas: 'Pass both key and value schemas to z.record().',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!isZodRecordCall(node) || node.arguments.length === 2) {
          return;
        }

        context.report({ node, messageId: 'missingKeyValueSchemas' });
      },
    };
  },
};

export default requireZodRecordKeyValue;

function isZodRecordCall(node) {
  return (
    node.callee?.type === 'MemberExpression' &&
    !node.callee.computed &&
    node.callee.object?.type === 'Identifier' &&
    node.callee.object.name === 'z' &&
    node.callee.property?.type === 'Identifier' &&
    node.callee.property.name === 'record'
  );
}
