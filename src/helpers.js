/**
 * Returns true if a given trait is defined as an Ory Kratos identifier
 */
function isIdentifierTrait(trait) {
  trait = trait.items || trait
  return trait?.['ory.sh/kratos']?.credentials?.password?.identifier === true
}

/**
 * Returns an array of trait keys defined as Ory Kratos identifiers
 */
function getIdentifierTraitsForSchema(schema) {
  return Object.entries(schema.properties?.traits?.properties || {})
    .filter(([, trait]) => isIdentifierTrait(trait))
    .map(([key]) => key)
}

/**
 * Returns the value of the first valid identifier in a given identity
 */
function getIdentityIdentifier(identity, schema) {
  let identifierTraits = getIdentifierTraitsForSchema(schema)

  for (let identifierTrait of identifierTraits) {
    let rawValue = identity.traits[identifierTrait]
    let value = Array.isArray(rawValue) ? rawValue[0] : rawValue

    if (value) {
      return value
    }
  }
}

/**
 * Converts a Kratos identity into an LDAP entry
 */
function identityToLdapEntry(identity, schema, identitiesDn) {
  let identifier = getIdentityIdentifier(identity, schema)

  if (!identifier) {
    return
  }

  return {
    dn: `identifier=${identifier},${identitiesDn}`,
    attributes: {
      id: identity.id,
      schema_id: identity.schema_id,
      objectClass: identity.schema_id,
      ...identity.traits,
    },
  }
}

export { identityToLdapEntry }
