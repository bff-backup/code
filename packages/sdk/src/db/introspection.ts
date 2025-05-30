import { wunderctl } from '../wunderctlexec';
import { FieldDefinitionNode, InputValueDefinitionNode, Kind, parse, parseType, print, TypeNode, visit } from 'graphql';
import { DatabaseIntrospection } from '../definition';
import { SingleTypeField } from '@bff-backup/protobuf';
import { DMMF } from '@prisma/generator-helper';
import { NamedTypeNode, ObjectTypeDefinitionNode } from 'graphql/language/ast';
import { startCase } from 'lodash';
import * as fs from 'fs';
import hash from 'object-hash';
import path from 'path';
import { resolveVariable } from '../configure/variables';
import { Logger } from '../logger';
import { DatabaseSchema, prisma } from './types';
import {
	getCustomScalarReplacementsByParent,
	handleScalarReplacementForChild,
} from '../transformations/replaceCustomScalars';

export interface PrismaDatabaseIntrospectionResult {
	success: boolean;
	message: string;
	prisma_schema: string;
	graphql_schema: string;
	dmmf?: DMMF.Document;
	interpolateVariableDefinitionAsJSON: string[];
	jsonTypeFields: SingleTypeField[];
	jsonResponseFields: SingleTypeField[];
}

const _ensurePrisma = async () => {
	Logger.info('Installing prisma...');
	const { failed, stderr } = await wunderctl({
		cmd: ['installPrismaDependencies'],
	});
	if (failed) {
		throw new Error(`Failed to install prisma: ${stderr}`);
	}
	Logger.info('Prisma installed');
};

let ensurePrisma: Promise<void> | undefined;

const introspectPrismaDatabase = async (
	databaseURL: string,
	databaseSchema: DatabaseSchema
): Promise<PrismaDatabaseIntrospectionResult> => {
	if (!ensurePrisma) {
		ensurePrisma = _ensurePrisma();
	}
	await ensurePrisma;
	const id = hash({ databaseURL, databaseSchema });
	const introspectionDir = path.join('generated', 'introspection', 'database');
	if (!fs.existsSync(introspectionDir)) {
		fs.mkdirSync(introspectionDir, { recursive: true });
	}
	const introspectionFilePath = path.join('generated', 'introspection', 'database', `${id}.json`);
	const cmd = ['introspect', databaseSchema, databaseURL, `--outfile=${introspectionFilePath}`, '--debug'];
	const { stdout: result } = await wunderctl({ cmd });
	if (result === undefined) {
		return {
			success: false,
			message: result,
			graphql_schema: '',
			prisma_schema: '',
			interpolateVariableDefinitionAsJSON: [],
			jsonTypeFields: [],
			jsonResponseFields: [],
		};
	}
	const output = fs.readFileSync(introspectionFilePath, 'utf8');
	let out: PrismaDatabaseIntrospectionResult;
	try {
		out = JSON.parse(output) as PrismaDatabaseIntrospectionResult;
	} catch (e: any) {
		throw new Error(`could not parse introspection output ${output}: ${e}`);
	}
	out.success = true;
	out.interpolateVariableDefinitionAsJSON = [];
	out.jsonTypeFields = [];
	out.jsonResponseFields = [];
	if (databaseSchema === prisma) {
		return out;
	}
	const dataSourceStart = out.prisma_schema.indexOf('datasource');
	const dataSourceEnd = out.prisma_schema.indexOf('}', dataSourceStart) + 1;
	out.prisma_schema = out.prisma_schema.replace(out.prisma_schema.substring(dataSourceStart, dataSourceEnd), '');
	while (out.prisma_schema.startsWith('\n')) {
		out.prisma_schema = out.prisma_schema.substring(1);
	}
	return out;
};

export const introspectPrismaDatabaseWithRetries = async (
	introspection: DatabaseIntrospection,
	databaseSchema: DatabaseSchema,
	maxRetries: number
): Promise<PrismaDatabaseIntrospectionResult> => {
	if (!introspection.databaseURL) {
		throw new Error('database URL is not defined');
	}
	const resolvedURL = resolveVariable(introspection.databaseURL);
	for (let i = 0; i < maxRetries; i++) {
		try {
			const result = await introspectPrismaDatabase(resolvedURL, databaseSchema);
			if (result.success) {
				const graphql_schema = cleanupPrismaSchema(introspection, result);
				const jsonResponseFields = findJsonResponseFields(result.graphql_schema);
				if (introspection.schemaExtension) {
					jsonResponseFields.push(...findJsonResponseFields(introspection.schemaExtension));
				}
				return {
					...result,
					graphql_schema,
					jsonResponseFields,
				};
			}
			Logger.error('database introspection failed: ' + (result.message || ''));
		} catch (e) {
			Logger.error('database introspection failed: ' + e);
		}
		Logger.info(`retrying database introspection ${i + 1}/${maxRetries}`);
	}

	const message = `introspection of ${databaseSchema} database failed after 5 attempts, make sure it's accessible at: ${introspection.databaseURL}
    Did you forget to add tables to the database? Make sure, you've run your initial migration.
    The introspection fails if there are no tables.
    Are you using a custom database schema? Make sure it's selected in the database URL.
    Please restart \"wunderctl up\" once the DB is running.
    `;

	return {
		success: false,
		message,
		prisma_schema: '',
		graphql_schema: '',
		interpolateVariableDefinitionAsJSON: [],
		jsonTypeFields: [],
		jsonResponseFields: [],
	};
};

const findJsonResponseFields = (graphql_schema: string): SingleTypeField[] => {
	const ast = parse(graphql_schema);
	const jsonResponseFields: SingleTypeField[] = [];
	let currentType: string | undefined;
	visit(ast, {
		ObjectTypeDefinition: (node) => {
			currentType = node.name.value;
		},
		FieldDefinition(node) {
			let nodeType = node.type;
			for (;;) {
				switch (nodeType.kind) {
					case 'NonNullType':
						nodeType = nodeType.type;
						continue;
					case 'ListType':
						nodeType = nodeType.type;
						continue;
					case 'NamedType':
						if (currentType && (nodeType.name.value === 'Json' || nodeType.name.value === 'JSON')) {
							jsonResponseFields.push({
								typeName: currentType,
								fieldName: node.name.value,
							});
						}
						return;
				}
			}
		},
	});
	return jsonResponseFields;
};

const floatScalars = ['Float32', 'Float64', 'Decimal'];
const intScalars = ['Int8', 'Int16', 'Int32', 'Int64', 'UInt8', 'UInt16', 'UInt32', 'UInt64', 'Long'];
const listInputFields = [
	'create',
	'createMany',
	'connect',
	'disconnect',
	'connectOrCreate',
	'upsert',
	'update',
	'updateMany',
	'delete',
];

export const nodeTypeIsList = (node: TypeNode): boolean => {
	if (node.kind === Kind.LIST_TYPE) {
		return true;
	}
	if (node.kind === Kind.NON_NULL_TYPE) {
		return nodeTypeIsList(node.type);
	}
	return false;
};

export const cleanupPrismaSchema = (
	introspection: DatabaseIntrospection,
	result: PrismaDatabaseIntrospectionResult
): string => {
	if (introspection.schemaExtension) {
		result.graphql_schema = result.graphql_schema + ' ' + introspection.schemaExtension;
	}
	result.graphql_schema = result.graphql_schema + rowSchema;

	const replacementsByParentName = getCustomScalarReplacementsByParent(
		introspection.replaceCustomScalarTypeFields || []
	);
	const replacementsByInterfaceName = new Map<string, Map<string, string>>();
	let customScalarReplacementName = '';
	let currentInputObjectTypeName = '';
	let currentValidParentTypeName = '';
	let currentParentInterfaces: string[] = [];
	const replacementScalars: Set<SingleTypeField> = new Set<SingleTypeField>();
	let currentObjectDefinition: ObjectTypeDefinitionNode | undefined;
	let currentFieldDefinition: FieldDefinitionNode | undefined;

	const document = parse(result.graphql_schema);
	const cleaned = visit(document, {
		ObjectTypeDefinition: {
			enter: (node) => {
				currentObjectDefinition = node;
				const nodeName = node.name.value;
				if (nodeName === 'Mutation') {
					// we don't like the prisma schema using just JSON, so we rewrite the fields
					return {
						...node,
						fields: [
							...(node.fields || []).filter((f) => f.name.value !== 'queryRaw' && f.name.value !== 'executeRaw'),
							executeRawField(),
						],
					};
				}
				if (nodeName === 'Query') {
					// adding raw query fields to query instead of mutation (as prisma does)
					// we're rewriting it later back to Mutation in the go engine
					return {
						...node,
						fields: [...(node.fields || []), queryRawRowField(), queryRawJsonField()],
					};
				}
				if (replacementsByParentName.get(nodeName)) {
					const interfaces = node.interfaces;
					if (interfaces) {
						// Keep record of the implemented interfaces until a scalar is replaced
						currentParentInterfaces = interfaces.map((i) => i.name.value);
					}
					currentValidParentTypeName = nodeName;
				}
			},
			leave: () => {
				currentObjectDefinition = undefined;
				currentValidParentTypeName = '';
				customScalarReplacementName = '';
				currentParentInterfaces = [];
			},
		},
		FieldDefinition: {
			enter: (node) => {
				currentFieldDefinition = node;
				customScalarReplacementName = handleScalarReplacementForChild(
					node,
					replacementsByParentName,
					currentValidParentTypeName,
					replacementScalars,
					undefined,
					currentParentInterfaces,
					replacementsByInterfaceName
				);
			},
			leave: (_) => {
				currentFieldDefinition = undefined;
				customScalarReplacementName = '';
			},
		},
		InputObjectTypeDefinition: {
			enter: (node) => {
				currentInputObjectTypeName = node.name.value;
				if (replacementsByParentName.get(currentInputObjectTypeName)) {
					currentValidParentTypeName = currentInputObjectTypeName;
				}
			},
			leave: () => {
				currentValidParentTypeName = '';
				customScalarReplacementName = '';
				currentInputObjectTypeName = '';
			},
		},
		InputValueDefinition: {
			enter: (node) => {
				customScalarReplacementName = handleScalarReplacementForChild(
					node,
					replacementsByParentName,
					currentValidParentTypeName,
					replacementScalars
				);

				if (listInputFields.includes(node.name.value)) {
					// potential list input field
					const relationship = resolveRelationship(currentInputObjectTypeName);
					if (!relationship) {
						return;
					}
					const from = result.dmmf?.datamodel.models.find((from) => from.name === relationship.from);
					if (!from) {
						return;
					}
					const to = from.fields.find((to) => to.name === relationship.to);
					if (!to) {
						return;
					}
					if (to.isList) {
						const modified: InputValueDefinitionNode = {
							...node,
							type: parseType(`[${print(node.type)}]`),
						};
						return modified;
					}
				}

				// Prisma accepts both a list and a single instance to *Many* methods and the DMMF
				// declares the argument type with both types. However, the generated GraphQL schema
				// by Prisma picks only the first of those types which, to make matters worse, is
				// not deterministic. Make sure that we only make the argument type a list if it wasn't
				// a list before.
				if (currentObjectDefinition && currentFieldDefinition && !nodeTypeIsList(node.type)) {
					const dmmfObject = result?.dmmf?.schema?.outputObjectTypes?.prisma.find(
						(x) => x.name === currentObjectDefinition?.name.value
					);
					const dmmfField = dmmfObject?.fields.find((x) => x.name === currentFieldDefinition?.name.value);
					const dmmfArg = dmmfField?.args.find((x) => x.name === node.name.value);
					const isList = dmmfArg?.inputTypes.find((arg) => arg.isList === true);
					if (isList) {
						let type: TypeNode;
						if (node.type.kind === Kind.NON_NULL_TYPE) {
							type = parseType(`[${print(node.type.type)}]!`);
						} else {
							type = parseType(`[${print(node.type)}]`);
						}
						const modified: InputValueDefinitionNode = {
							...node,
							type,
						};
						return modified;
					}
				}
			},
			leave: () => {
				customScalarReplacementName = '';
			},
		},
		NamedType: (node) => {
			if (floatScalars.includes(node.name.value)) {
				return {
					...node,
					name: {
						...node.name,
						value: 'Float',
					},
				};
			}
			if (intScalars.includes(node.name.value)) {
				return {
					...node,
					name: {
						...node.name,
						value: 'Int',
					},
				};
			}
			if (node.name.value === 'Json' || node.name.value === 'JsonNullValueInput') {
				if (
					customScalarReplacementName &&
					result.interpolateVariableDefinitionAsJSON.indexOf(customScalarReplacementName) === -1
				) {
					result.interpolateVariableDefinitionAsJSON.push(customScalarReplacementName);
				}

				if (customScalarReplacementName) {
					return {
						...node,
						name: {
							...node.name,
							value: customScalarReplacementName,
						},
					};
				}

				return {
					...node,
					name: {
						...node.name,
						value: 'JSON',
					},
				};
			}
		},
		ScalarTypeDefinition: (node) => {
			if (floatScalars.includes(node.name.value) || intScalars.includes(node.name.value)) {
				return null;
			}
			if (node.name.value === 'Json') {
				return {
					...node,
					name: {
						...node.name,
						value: 'JSON',
					},
				};
			}
		},
		EnumTypeDefinition: (node) => {
			if (node.name.value === 'JsonNullValueInput') {
				return null;
			}
		},
	});

	for (const replacementScalar of replacementScalars) {
		result.jsonTypeFields.push(replacementScalar);
	}

	if (replacementsByInterfaceName.size < 1) {
		return print(cleaned);
	}

	const cleanedWithInterfaces = visit(cleaned, {
		InterfaceTypeDefinition: {
			enter: (node) => {
				if (replacementsByInterfaceName.get(node.name.value)) {
					currentValidParentTypeName = node.name.value;
				} else {
					// Skip this parent
					return false;
				}
			},
			leave: (_) => {
				currentValidParentTypeName = '';
				customScalarReplacementName = '';
			},
		},
		FieldDefinition: {
			enter: (node) => {
				customScalarReplacementName = handleScalarReplacementForChild(
					node,
					replacementsByInterfaceName,
					currentValidParentTypeName,
					replacementScalars
				);
			},
			leave: (_) => {
				customScalarReplacementName = '';
			},
		},
		NamedType: (node) => {
			if (customScalarReplacementName) {
				return { ...node, name: { ...node.name, value: customScalarReplacementName } };
			}
		},
	});

	return print(cleanedWithInterfaces);
};

const queryRawRowField = (): FieldDefinitionNode => ({
	kind: Kind.FIELD_DEFINITION,
	name: {
		kind: Kind.NAME,
		value: 'queryRaw',
	},
	type: {
		kind: Kind.NON_NULL_TYPE,
		type: {
			kind: Kind.LIST_TYPE,
			type: {
				kind: Kind.NON_NULL_TYPE,
				type: {
					kind: Kind.NAMED_TYPE,
					name: {
						kind: Kind.NAME,
						value: '_Row',
					},
				},
			},
		},
	},
	arguments: [
		{
			kind: Kind.INPUT_VALUE_DEFINITION,
			name: {
				kind: Kind.NAME,
				value: 'query',
			},
			type: {
				kind: Kind.NON_NULL_TYPE,
				type: {
					kind: Kind.NAMED_TYPE,
					name: {
						kind: Kind.NAME,
						value: 'String',
					},
				},
			},
		},
		{
			kind: Kind.INPUT_VALUE_DEFINITION,
			name: {
				kind: Kind.NAME,
				value: 'parameters',
			},
			type: {
				kind: Kind.LIST_TYPE,
				type: {
					kind: Kind.NAMED_TYPE,
					name: {
						kind: Kind.NAME,
						value: 'String',
					},
				},
			},
		},
	],
});

const queryRawJsonField = (): FieldDefinitionNode => ({
	kind: Kind.FIELD_DEFINITION,
	name: {
		kind: Kind.NAME,
		value: 'queryRawJSON',
	},
	type: {
		kind: Kind.NAMED_TYPE,
		name: {
			kind: Kind.NAME,
			value: 'JSON',
		},
	},
	arguments: [
		{
			kind: Kind.INPUT_VALUE_DEFINITION,
			name: {
				kind: Kind.NAME,
				value: 'query',
			},
			type: {
				kind: Kind.NON_NULL_TYPE,
				type: {
					kind: Kind.NAMED_TYPE,
					name: {
						kind: Kind.NAME,
						value: 'String',
					},
				},
			},
		},
		{
			kind: Kind.INPUT_VALUE_DEFINITION,
			name: {
				kind: Kind.NAME,
				value: 'parameters',
			},
			type: {
				kind: Kind.LIST_TYPE,
				type: {
					kind: Kind.NAMED_TYPE,
					name: {
						kind: Kind.NAME,
						value: 'String',
					},
				},
			},
		},
	],
});

const executeRawField = (): FieldDefinitionNode => ({
	kind: Kind.FIELD_DEFINITION,
	name: {
		kind: Kind.NAME,
		value: 'executeRaw',
	},
	type: {
		kind: Kind.NON_NULL_TYPE,
		type: {
			kind: Kind.NAMED_TYPE,
			name: {
				kind: Kind.NAME,
				value: 'Int',
			},
		},
	},
	arguments: [
		{
			kind: Kind.INPUT_VALUE_DEFINITION,
			name: {
				kind: Kind.NAME,
				value: 'query',
			},
			type: {
				kind: Kind.NON_NULL_TYPE,
				type: {
					kind: Kind.NAMED_TYPE,
					name: {
						kind: Kind.NAME,
						value: 'String',
					},
				},
			},
		},
		{
			kind: Kind.INPUT_VALUE_DEFINITION,
			name: {
				kind: Kind.NAME,
				value: 'parameters',
			},
			type: {
				kind: Kind.LIST_TYPE,
				type: {
					kind: Kind.NAMED_TYPE,
					name: {
						kind: Kind.NAME,
						value: 'String',
					},
				},
			},
		},
	],
});

const rowSchema = `

type _Row {
	ID: ID!
	Int: Int!
	Float: Float!
	String: String!
	Boolean: Boolean!
	DateTime: DateTime!
	JSON: JSON!
	Object: _Row!
	Array: [_Row!]!
	OptionalID: ID
	OptionalInt: Int
	OptionalFloat: Float
	OptionalString: String
	OptionalBoolean: Boolean
	OptionalDateTime: DateTime
	OptionalJSON: JSON
	OptionalObject: _Row
	OptionalArray: [_Row!]
}

`;

const unwrapNamedType = (node: TypeNode): NamedTypeNode => {
	if (node.kind === 'NamedType') {
		return node;
	}
	if (node.kind === 'NonNullType') {
		return unwrapNamedType(node.type);
	}
	if (node.kind === 'ListType') {
		return unwrapNamedType(node.type);
	}
	throw new Error(`unexpected type node: ${print(node)}`);
};

interface Relationship {
	from: string;
	to: string;
}

const resolveRelationship = (connectionType: string): Relationship | undefined => {
	connectionType = connectionType.replace('CreateMany', '');
	connectionType = connectionType.replace('CreateOrConnectWithout', '');
	connectionType = connectionType.replace('CreateOrConnect', '');
	connectionType = connectionType.replace('CreateWithout', '');
	connectionType = connectionType.replace('UpdateWithout', '');
	connectionType = connectionType.replace('UpdateWithWhereUniqueWithout', '');
	connectionType = connectionType.replace('UpsertWithout', '');
	connectionType = connectionType.replace('UpsertWithWhereUniqueWithout', '');
	connectionType = connectionType.replace('UpdateManyWithWhereWithout', '');
	connectionType = connectionType.replace('CreateNestedOneWithout', '');
	connectionType = connectionType.replace('CreateNestedManyWithout', '');
	connectionType = connectionType.replace('UpdateOneRequiredWithout', '');
	connectionType = connectionType.replace('UpdateManyWithout', '');
	connectionType = connectionType.replace('UpdateOneWithout', '');
	connectionType = connectionType.replace('UpdateMany', '');
	if (connectionType.endsWith('InputEnvelope')) {
		connectionType = connectionType.substring(0, connectionType.length - 'InputEnvelope'.length);
	}
	if (connectionType.endsWith('Input')) {
		connectionType = connectionType.substring(0, connectionType.length - 'Input'.length);
	}
	if (connectionType.endsWith('WhereUnique')) {
		connectionType = connectionType.substring(0, connectionType.length - 'WhereUnique'.length);
	}
	const fromTo = startCase(connectionType).split(' ');
	if (fromTo.length === 1) {
		return undefined;
	}
	if (fromTo.length !== 2) {
		return undefined;
	}
	return {
		from: fromTo[1].toLowerCase(),
		to: fromTo[0].toLowerCase(),
	};
};
