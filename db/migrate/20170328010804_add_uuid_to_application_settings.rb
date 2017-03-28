class AddUuidToApplicationSettings < ActiveRecord::Migration
  include Gitlab::Database::MigrationHelpers

  DOWNTIME = false

  disable_ddl_transaction!

  def up
    add_column :application_settings, :uuid, :string
    add_concurrent_index :application_settings, :uuid
    execute("UPDATE application_settings SET uuid = #{quote(generate_random_string(40))}")
  end

  def down
    remove_index :application_settings, :uuid if index_exists?(:application_settings, :uuid)
    remove_column :application_settings, :uuid
  end

  private

  def generate_random_string(size)
    # urlsafe_base64 may return a string of size * 4/3
    SecureRandom.urlsafe_base64(size)[0, size]
  end
end
