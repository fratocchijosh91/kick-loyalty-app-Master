import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';
import { apiUrl } from '../lib/apiUrl';

const OrganizationContext = createContext();

export const OrganizationProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [organizations, setOrganizations] = useState([]);
  const [currentOrg, setCurrentOrg] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load organizations on auth
  useEffect(() => {
    if (isAuthenticated) {
      loadOrganizations();
    }
  }, [isAuthenticated]);

  // Load organization context from URLs or localStorage
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orgFromUrl = params.get('org');

    if (orgFromUrl) {
      setCurrentOrgBySlug(orgFromUrl);
    } else {
      // Try from localStorage
      const saved = localStorage.getItem('kickloyalty_current_org');
      if (saved) {
        setCurrentOrgBySlug(saved);
      } else if (organizations.length > 0) {
        // Default to first org
        setCurrentOrgBySlug(organizations[0].slug);
      }
    }
  }, [organizations]);

  const loadOrganizations = async () => {
    try {
      setLoading(true);
      const response = await axios.get(apiUrl('organizations'));
      setOrganizations(response.data.organizations || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Errore nel caricamento organizzazioni');
    } finally {
      setLoading(false);
    }
  };

  const loadOrganizationDetail = async (slug) => {
    try {
      setLoading(true);
      const response = await axios.get(apiUrl(`organizations/${slug}?organization=${slug}`));
      setCurrentOrg(response.data);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.error || 'Errore nel caricamento organizzazione');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const setCurrentOrgBySlug = async (slug) => {
    try {
      const org = await loadOrganizationDetail(slug);
      localStorage.setItem('kickloyalty_current_org', slug);
      return org;
    } catch (err) {
      console.error('Errore caricamento org:', err);
    }
  };

  const createOrganization = async (name, description = '') => {
    try {
      setLoading(true);
      const response = await axios.post(apiUrl('organizations'), { name, description });
      const newOrg = response.data.organization;
      setOrganizations([...organizations, newOrg]);
      await setCurrentOrgBySlug(newOrg.slug);
      return newOrg;
    } catch (err) {
      setError(err.response?.data?.error || 'Errore creazione organizzazione');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateOrganization = async (slug, data) => {
    try {
      setLoading(true);
      const response = await axios.patch(apiUrl(`organizations/${slug}?organization=${slug}`), data);
      setCurrentOrg(response.data.organization);
      setOrganizations(
        organizations.map(org => org.slug === slug ? response.data.organization : org)
      );
      return response.data.organization;
    } catch (err) {
      setError(err.response?.data?.error || 'Errore aggiornamento organizzazione');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const switchOrganization = async (slug) => {
    await setCurrentOrgBySlug(slug);
  };

  // Team operations
  const loadTeamMembers = async (slug) => {
    try {
      const response = await axios.get(apiUrl(`organizations/${slug}/team?organization=${slug}`));
      return response.data.members || [];
    } catch (err) {
      setError(err.response?.data?.error || 'Errore caricamento team');
      throw err;
    }
  };

  const inviteTeamMember = async (slug, email, role = 'viewer') => {
    try {
      const response = await axios.post(
        apiUrl(`organizations/${slug}/team/invite?organization=${slug}`),
        { email, role }
      );
      return response.data;
    } catch (err) {
      setError(err.response?.data?.error || 'Errore invito membro');
      throw err;
    }
  };

  const updateTeamMember = async (slug, memberId, role) => {
    try {
      const response = await axios.patch(
        apiUrl(`organizations/${slug}/team/${memberId}?organization=${slug}`),
        { role }
      );
      return response.data;
    } catch (err) {
      setError(err.response?.data?.error || 'Errore aggiornamento membro');
      throw err;
    }
  };

  const removeTeamMember = async (slug, memberId) => {
    try {
      const response = await axios.delete(
        apiUrl(`organizations/${slug}/team/${memberId}?organization=${slug}`)
      );
      return response.data;
    } catch (err) {
      setError(err.response?.data?.error || 'Errore rimozione membro');
      throw err;
    }
  };

  // Rewards operations
  const loadRewards = async (slug) => {
    try {
      const response = await axios.get(apiUrl(`organizations/${slug}/rewards?organization=${slug}`));
      return response.data || [];
    } catch (err) {
      setError(err.response?.data?.error || 'Errore caricamento rewards');
      throw err;
    }
  };

  const createReward = async (slug, reward) => {
    try {
      const response = await axios.post(
        apiUrl(`organizations/${slug}/rewards?organization=${slug}`),
        reward
      );
      return response.data;
    } catch (err) {
      const message = err.response?.data?.error || err.response?.data?.code || 'Errore creazione reward';
      setError(message);
      throw new Error(message);
    }
  };

  // Billing operations
  const loadBillingInfo = async (slug) => {
    try {
      const response = await axios.get(apiUrl(`organizations/${slug}/billing?organization=${slug}`));
      return response.data;
    } catch (err) {
      setError(err.response?.data?.error || 'Errore caricamento billing');
      throw err;
    }
  };

  const upgradePlan = async (slug, planSlug) => {
    try {
      const response = await axios.post(
        apiUrl(`organizations/${slug}/billing/upgrade?organization=${slug}`),
        { planSlug }
      );
      return response.data;
    } catch (err) {
      setError(err.response?.data?.error || 'Errore upgrade plan');
      throw err;
    }
  };

  const cancelSubscription = async (slug) => {
    try {
      const response = await axios.post(
        apiUrl(`organizations/${slug}/billing/cancel?organization=${slug}`)
      );
      await setCurrentOrgBySlug(slug);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.error || 'Errore cancellazione subscription');
      throw err;
    }
  };

  return (
    <OrganizationContext.Provider
      value={{
        organizations,
        currentOrg,
        loading,
        error,
        loadOrganizations,
        loadOrganizationDetail,
        createOrganization,
        updateOrganization,
        switchOrganization,
        loadTeamMembers,
        inviteTeamMember,
        updateTeamMember,
        removeTeamMember,
        loadRewards,
        createReward,
        loadBillingInfo,
        upgradePlan,
        cancelSubscription,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
};

export const useOrganization = () => {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganization must be used within OrganizationProvider');
  }
  return context;
};
