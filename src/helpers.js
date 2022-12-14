/**
 * Returns true if a given trait is defined as an Ory Kratos identifier
 */
function isIdentifierTrait(trait) {
  trait = trait.items || trait
  return trait?.['ory.sh/kratos']?.credentials?.password?.identifier === true
}

/**
 * Returns a schema's traits defined as Ory Kratos identifiers
 */
function getIdentifierTraitsForSchema(schema) {
  return Object.entries(schema.properties?.traits?.properties || {}).reduce(
    (result, [key, trait]) => {
      if (isIdentifierTrait(trait)) {
        result[key] = trait
      }
      return result
    }
  )
}

/**
 * Returns an array of all values that belong to identifier traits of an identity
 */
function getIdentifierValuesForIdentity(identity, schema) {
  let identifierTraits = getIdentifierTraitsForSchema(schema)
  return Object.keys(identity.traits || {}).reduce((result, key) => {
    let value = identity.traits[key]
    if (value && identifierTraits[key]) {
      value = identifierTraits[key].type === 'array' ? value : [value]
      result.push(...value)
    }
    return result
  }, [])
}

/**
 * Returns the value of the first valid identifier in a given identity
 */
function getIdentifierValueForIdentity(identity, schema) {
  return getIdentifierValuesForIdentity(identity, schema)[0]
}

/**
 * Checks if a given value is among the identifier values of an identity
 */
function isValidIdentifierValueForIdentity(value, identity, schema) {
  return getIdentifierValuesForIdentity(identity, schema).includes(value)
}

/**
 * Converts a Kratos identity into an LDAP entry
 */
function identityToLdapEntry(identity, schema, identitiesDn) {
  let identifier = getIdentifierValueForIdentity(identity, schema)
  console.log(identity, identifier)

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

export {
  isIdentifierTrait,
  getIdentifierTraitsForSchema,
  getIdentifierValuesForIdentity,
  getIdentifierValueForIdentity,
  isValidIdentifierValueForIdentity,
  identityToLdapEntry,
}
