import React from 'react';
import { ControlProps } from '@jsonforms/core';
import { withJsonFormsControlProps } from '@jsonforms/react';
import {
  Box,
  FormHelperText,
  Typography,
  TextField,
  Button,
  Autocomplete,
  CircularProgress,
} from '@mui/material';
import { isControl, rankWith } from '@jsonforms/core';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import { credentialsService, CredentialResponse } from '../../service/CredentialsService';

// Mock credentials for local testing - set to true to use mock data
const USE_MOCK_DATA = false;

const MOCK_CREDENTIALS: Record<string, CredentialResponse[]> = {
  BASIC: [
    {
      userId: 'anonymous',
      name: 'admin-basic-auth',
      type: 'BASIC',
      typeVersion: '1.0.0',
      description: 'Admin credentials for internal APIs',
      createdAt: '2026-04-24T10:00:00Z',
      updatedAt: '2026-04-24T10:00:00Z',
    },
    {
      userId: 'anonymous',
      name: 'service-account',
      type: 'BASIC',
      typeVersion: '1.0.0',
      description: 'Service account for batch jobs',
      createdAt: '2026-04-24T11:00:00Z',
      updatedAt: '2026-04-24T11:00:00Z',
    },
  ],
  TOKEN: [
    {
      userId: 'anonymous',
      name: 'github-token',
      type: 'TOKEN',
      typeVersion: '1.0.0',
      description: 'GitHub API access token',
      createdAt: '2026-04-24T12:00:00Z',
      updatedAt: '2026-04-24T12:00:00Z',
    },
    {
      userId: 'anonymous',
      name: 'openai-api-key',
      type: 'TOKEN',
      typeVersion: '1.0.0',
      description: 'OpenAI API key for LLM calls',
      createdAt: '2026-04-24T13:00:00Z',
      updatedAt: '2026-04-24T13:00:00Z',
    },
  ],
  GENERIC: [
    {
      userId: 'anonymous',
      name: 'basic-api-creds',
      type: 'GENERIC',
      typeVersion: '1.0.0',
      description: 'Generic API credentials',
      createdAt: '2026-04-24T19:14:21Z',
      updatedAt: '2026-04-24T19:14:21Z',
    },
  ],
};

const getMockCredentials = (type?: string): CredentialResponse[] => {
  if (type) {
    return MOCK_CREDENTIALS[type] || [];
  }
  // Return all credentials
  return Object.values(MOCK_CREDENTIALS).flat();
};

interface CredentialRendererProps extends ControlProps {
  options?: {
    format?: string;
    credentialType?: string;
  };
}

const CredentialRenderer: React.FC<CredentialRendererProps> = (props) => {
  const {
    data,
    handleChange,
    label,
    errors,
    visible,
    path,
    uischema,
  } = props;

  // Options are in uischema.options, not directly in props
  const options = (uischema as any)?.options || {};
  const credentialType = options.credentialType || '';
  const format = options.format || '';

  console.log('[CredentialRenderer] Render called with props:', {
    path,
    label,
    format,
    credentialType,
    visible,
    data,
    options,
    uischema,
  });

  const [credentials, setCredentials] = React.useState<CredentialResponse[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Fetch credentials based on type
  const fetchCredentials = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let fetchedCredentials: CredentialResponse[];

      if (USE_MOCK_DATA) {
        // Use mock data for local testing
        await new Promise(resolve => setTimeout(resolve, 300)); // Simulate network delay
        fetchedCredentials = getMockCredentials(credentialType);
      } else if (credentialType) {
        // Fetch credentials filtered by type
        fetchedCredentials = await credentialsService.listByType(credentialType);
      } else {
        // Fetch all credentials
        fetchedCredentials = await credentialsService.list();
      }

      setCredentials(fetchedCredentials);
    } catch (err) {
      console.error('Failed to fetch credentials:', err);
      setError(err instanceof Error ? err.message : 'Failed to load credentials');
      setCredentials([]);
    } finally {
      setLoading(false);
    }
  }, [credentialType]);

  // Fetch credentials only when visible and credentialType changes
  React.useEffect(() => {
    if (visible && format === 'credential') {
      fetchCredentials();
    }
  }, [fetchCredentials, visible, format]);

  const handleAutocompleteChange = (
    _event: React.SyntheticEvent,
    value: CredentialResponse | null
  ) => {
    handleChange(path, value?.name || '');
  };

  const handleAddNew = () => {
    // Open credentials manager UI in a new browser tab
    window.open('/credentials-manager/ui', '_blank');
  };

  if (format !== 'credential') {
    console.log('[CredentialRenderer] Returning null - format is not "credential":', format);
    return null;
  }

  if (!visible) {
    console.log('[CredentialRenderer] Returning null - not visible');
    return null;
  }

  console.log('[CredentialRenderer] Rendering component with credentials:', credentials);

  const hasError = Boolean(errors && errors.length > 0);
  const errorMessage = hasError ? errors : undefined;

  return (
    <Box sx={{ width: '100%', mb: 2 }}>
      {label && (
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
          {label}
        </Typography>
      )}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Autocomplete
          fullWidth
          size="small"
          options={credentials}
          getOptionLabel={(option) => option.name}
          value={credentials.find((c) => c.name === data) || null}
          onChange={handleAutocompleteChange}
          loading={loading}
          disabled={loading}
          isOptionEqualToValue={(option, value) => option.name === value.name}
          renderOption={(props, option) => (
            <li {...props} key={option.name}>
              <Box>
                <Typography variant="body2">{option.name}</Typography>
                {option.description && (
                  <Typography variant="caption" color="text.secondary">
                    {option.description}
                  </Typography>
                )}
              </Box>
            </li>
          )}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Select Credential"
              error={hasError || !!error}
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {loading ? <CircularProgress color="inherit" size={20} /> : null}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          )}
          slotProps={{
            popper: {
              sx: { zIndex: 9999 }
            }
          }}
        />
        <Button
          variant="outlined"
          size="small"
          onClick={fetchCredentials}
          disabled={loading}
          sx={{ minWidth: 'auto', p: '4px' }}
          title="Refresh credentials"
        >
          <RefreshIcon fontSize="small" />
        </Button>
        <Button
          variant="outlined"
          size="small"
          startIcon={<AddIcon />}
          onClick={handleAddNew}
          sx={{ whiteSpace: 'nowrap', minWidth: 'auto' }}
        >
          New
        </Button>
      </Box>
      {error && (
        <FormHelperText error={true} sx={{ mt: 1 }}>
          {error}
        </FormHelperText>
      )}
      {errorMessage && (
        <FormHelperText error={true} sx={{ mt: 1 }}>
          {errorMessage}
        </FormHelperText>
      )}
    </Box>
  );
};

const CredentialControl = withJsonFormsControlProps(CredentialRenderer);

// Tester to determine when to use this renderer
export const credentialTester = rankWith(
  10,
  (uischema: any) => {
    const isMatch = isControl(uischema) && uischema.options?.format === 'credential';
    console.log('[credentialTester] Testing uischema:', {
      type: uischema?.type,
      scope: uischema?.scope,
      options: uischema?.options,
      isControl: isControl(uischema),
      hasCredentialFormat: uischema?.options?.format === 'credential',
      isMatch,
    });
    return isMatch;
  }
);

export { CredentialControl };
export default CredentialControl;


